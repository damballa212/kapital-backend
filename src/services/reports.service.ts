import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { findTransactionsForExport } from '../repositories/transaction.repository.js'
import type { FiltroReporte, Transaction } from '../domain/transaction.js'
import { formatGs, formatUsd, formatPct } from '../utils/formatters.js'

const TZ = 'America/Asuncion'

const ALL_FIELDS = [
  { key: 'id',                     label: 'ID' },
  { key: 'fecha',                  label: 'Fecha' },
  { key: 'cliente',                label: 'Cliente' },
  { key: 'colaborador',            label: 'Colaborador' },
  { key: 'usd_total',              label: 'USD Total' },
  { key: 'comision',               label: 'Comisión %' },
  { key: 'usd_neto',               label: 'USD Neto' },
  { key: 'monto_gs',               label: 'Monto Gs' },
  { key: 'com_colaborador_usd',    label: 'Com. Colaborador USD' },
  { key: 'com_gabriel_usd',        label: 'Com. Gabriel USD' },
  { key: 'com_colaborador_gs',     label: 'Com. Colaborador Gs' },
  { key: 'com_gabriel_gs',         label: 'Com. Gabriel Gs' },
  { key: 'tasa_usada',             label: 'Tasa Usada' },
  { key: 'observaciones',          label: 'Observaciones' },
]

function fechaPY(d: Date): string {
  return d.toLocaleString('es-PY', { timeZone: TZ, hour12: false })
    .replace(',', '')
}

function getFieldValue(r: Transaction, key: string): string | number {
  switch (key) {
    case 'id':                  return r.id
    case 'fecha':               return fechaPY(r.fecha)
    case 'cliente':             return r.cliente
    case 'colaborador':         return r.colaborador ?? ''
    case 'usd_total':           return r.usdTotal
    case 'comision':            return r.comision
    case 'usd_neto':            return r.usdNeto
    case 'monto_gs':            return r.montoGs
    case 'com_colaborador_usd': return r.montoColaboradorUsd
    case 'com_gabriel_usd':     return r.montoComisionGabrielUsd
    case 'com_colaborador_gs':  return r.montoColaboradorGs
    case 'com_gabriel_gs':      return r.montoComisionGabrielGs
    case 'tasa_usada':          return r.tasaUsada
    case 'observaciones':       return r.observaciones ?? ''
    default:                    return ''
  }
}

function resolveFields(requested?: string[]) {
  if (!requested || requested.length === 0) return ALL_FIELDS
  return ALL_FIELDS.filter(f => requested.includes(f.key))
}

// ── CSV ───────────────────────────────────────────────────────────────────────
export async function generarCSV(filtros: FiltroReporte): Promise<string> {
  const rows = await findTransactionsForExport(filtros)
  const fields = resolveFields(filtros.fields)
  const lines = [
    fields.map(f => f.label).join(','),
    ...rows.map(r =>
      fields.map(f => {
        const v = getFieldValue(r, f.key)
        return typeof v === 'string' && v.includes(',') ? `"${v}"` : v
      }).join(',')
    ),
  ]
  return lines.join('\n')
}

// ── EXCEL ─────────────────────────────────────────────────────────────────────
export async function generarExcel(filtros: FiltroReporte): Promise<Buffer> {
  const rows = await findTransactionsForExport(filtros)
  const fields = resolveFields(filtros.fields)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Kontigo'

  // ── Hoja 1: Transacciones ──
  const ws = wb.addWorksheet('Transacciones')
  const GREEN_DARK  = 'FF1A5C38'
  const GREEN_LIGHT = 'FFE6F4EC'

  ws.columns = fields.map(f => ({
    header: f.label,
    key: f.key,
    width: ['cliente','colaborador','fecha','observaciones'].includes(f.key) ? 22 : 14,
  }))

  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_DARK } }
  headerRow.height = 22

  rows.forEach((r, i) => {
    const values: Record<string, string | number> = {}
    fields.forEach(f => { values[f.key] = getFieldValue(r, f.key) })
    const row = ws.addRow(values)
    if (i % 2 === 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_LIGHT } }
    }
    // formato numérico
    fields.forEach((f, col) => {
      const cell = row.getCell(col + 1)
      if (['usd_total','usd_neto','com_colaborador_usd','com_gabriel_usd'].includes(f.key))
        cell.numFmt = '$#,##0.00'
      else if (['monto_gs','com_colaborador_gs','com_gabriel_gs'].includes(f.key))
        cell.numFmt = '#,##0'
      else if (f.key === 'comision')
        cell.numFmt = '0.00"%"'
      else if (f.key === 'tasa_usada')
        cell.numFmt = '#,##0.0000'
    })
  })

  // fila de totales
  const numFields = ['usd_total','usd_neto','monto_gs','com_colaborador_usd','com_gabriel_usd','com_colaborador_gs','com_gabriel_gs']
  const totals: Record<string, string | number> = {}
  fields.forEach(f => {
    if (numFields.includes(f.key)) totals[f.key] = rows.reduce((s, r) => s + (getFieldValue(r, f.key) as number), 0)
    else totals[f.key] = f.key === 'id' ? 'TOTAL' : ''
  })
  const totRow = ws.addRow(totals)
  totRow.font = { bold: true }
  totRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6EAD7' } }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: fields.length } }
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  // ── Hoja 2: Resumen ──
  const ws2 = wb.addWorksheet('Resumen')
  const totalUsd  = rows.reduce((s, r) => s + r.usdTotal, 0)
  const totalGs   = rows.reduce((s, r) => s + r.montoGs, 0)
  const comGab    = rows.reduce((s, r) => s + r.montoComisionGabrielUsd, 0)
  const comColab  = rows.reduce((s, r) => s + r.montoColaboradorUsd, 0)

  const summary = [
    ['Métrica', 'Valor'],
    ['Total transacciones', rows.length],
    ['USD movido', totalUsd],
    ['Gs entregados', totalGs],
    ['Comisión Gabriel USD', comGab],
    ['Comisión Colaboradores USD', comColab],
    ['Tasa promedio', rows.length ? rows.reduce((s, r) => s + r.tasaUsada, 0) / rows.length : 0],
  ]
  summary.forEach((row, i) => {
    const r = ws2.addRow(row)
    if (i === 0) {
      r.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_DARK } }
    }
    const cell = r.getCell(2)
    if (i === 2) cell.numFmt = '$#,##0.00'
    if (i === 3) cell.numFmt = '#,##0'
    if (i === 4 || i === 5) cell.numFmt = '$#,##0.00'
    if (i === 6) cell.numFmt = '#,##0.0000'
  })
  ws2.getColumn(1).width = 28
  ws2.getColumn(2).width = 18

  // ── Hoja 3: Por Colaborador ──
  const ws3 = wb.addWorksheet('Por Colaborador')
  const byColab = new Map<string, { txs: number; usd: number; comUsd: number }>()
  rows.forEach(r => {
    const name = r.colaborador ?? 'Gabriel Zambrano'
    const cur = byColab.get(name) ?? { txs: 0, usd: 0, comUsd: 0 }
    byColab.set(name, { txs: cur.txs + 1, usd: cur.usd + r.usdTotal, comUsd: cur.comUsd + r.montoColaboradorUsd })
  })
  const hdr3 = ws3.addRow(['Colaborador', 'Transacciones', 'USD Movido', 'Comisión USD'])
  hdr3.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  hdr3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_DARK } }
  byColab.forEach((v, name) => {
    const r = ws3.addRow([name, v.txs, v.usd, v.comUsd])
    r.getCell(3).numFmt = '$#,##0.00'
    r.getCell(4).numFmt = '$#,##0.00'
  })
  ws3.columns = [{ width: 24 }, { width: 16 }, { width: 16 }, { width: 16 }]

  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>
}

// ── PDF ───────────────────────────────────────────────────────────────────────
export async function generarPDF(filtros: FiltroReporte): Promise<Buffer> {
  const rows   = await findTransactionsForExport(filtros)
  const fields = resolveFields(filtros.fields)

  // Paleta — SOLO hex strings (PDFKit no acepta rgb() CSS ni rgba())
  const C = {
    headerBg:   '#0A1F0F',  // verde casi negro para header
    green:      '#1A5C38',  // verde corporativo
    accent:     '#2EB85C',  // verde brillante para accents
    rowAlt:     '#F2F8F4',  // fila alternada muy sutil
    border:     '#D4E8DC',  // separadores
    muted:      '#6B8C77',  // texto secundario
    ink:        '#111A14',  // texto principal
    white:      '#FFFFFF',
    cardA:      '#0A1F0F',  // card transacciones
    cardB:      '#0C2D5C',  // card volumen USD
    cardC:      '#1A3A20',  // card comisión
    cardD:      '#1A1A2E',  // card guaraníes
    cardLabel:  '#7EC99A',  // label en card
    cardSub:    '#A8C4B0',  // subtexto en card
  }

  const PAGE_W = 841.89
  const PAGE_H = 595.28
  const LEFT   = 44
  const USABLE = PAGE_W - LEFT * 2
  const HDR_H  = 64
  const FTR_Y  = PAGE_H - 26
  const CT     = HDR_H + 16  // content top

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, autoFirstPage: false })
  const chunks: Buffer[] = []
  doc.on('data', (b: Buffer) => chunks.push(b))

  // ── Anchos de columna proporcionales ─────────────────────────────────────
  const PREF: Record<string, number> = {
    id: 30, fecha: 66, cliente: 96, colaborador: 80, usd_total: 56,
    comision: 42, usd_neto: 56, monto_gs: 62, com_colaborador_usd: 70,
    com_gabriel_usd: 70, com_colaborador_gs: 70, com_gabriel_gs: 70,
    tasa_usada: 56, observaciones: 88,
  }
  const prefSum  = fields.reduce((s, f) => s + (PREF[f.key] ?? 58), 0)
  const colW     = fields.map(f => Math.floor((PREF[f.key] ?? 58) / prefSum * USABLE))
  const colX     = (i: number) => LEFT + colW.slice(0, i).reduce((s, w) => s + w, 0)

  let pageNum    = 0
  let totalPages = 0

  // ── Shell: header + footer ────────────────────────────────────────────────
  function shell(pg: number, tot: number) {
    // header background
    doc.rect(0, 0, PAGE_W, HDR_H).fill(C.headerBg)
    // accent stripe
    doc.rect(0, HDR_H - 3, PAGE_W, 3).fill(C.accent)

    // ícono K
    doc.rect(LEFT, 11, 42, 42).fill(C.green)
    doc.fillColor(C.white).fontSize(21).font('Helvetica-Bold')
      .text('K', LEFT, 17, { width: 42, align: 'center', lineBreak: false })

    // nombre y subtítulo
    doc.fillColor(C.white).fontSize(18).font('Helvetica-Bold')
      .text('KONTIGO', LEFT + 52, 13, { lineBreak: false })
    doc.fillColor(C.cardSub).fontSize(8).font('Helvetica')
      .text('Casa de Cambios  ·  Reporte de Transacciones', LEFT + 52, 35, { lineBreak: false })

    // fecha + página (derecha)
    const gen = new Date().toLocaleString('es-PY', { timeZone: TZ })
    doc.fillColor(C.cardLabel).fontSize(7)
      .text(`Generado  ${gen}`, PAGE_W - LEFT - 200, 16, { width: 200, align: 'right', lineBreak: false })
    doc.fillColor(C.white).fontSize(8).font('Helvetica-Bold')
      .text(`${pg} / ${tot}`, PAGE_W - LEFT - 200, 30, { width: 200, align: 'right', lineBreak: false })

    // footer
    doc.rect(LEFT, FTR_Y - 2, USABLE, 0.5).fill(C.border)
    doc.fillColor(C.muted).fontSize(6.5).font('Helvetica')
      .text('KONTIGO  ·  Documento Confidencial  ·  Uso Interno', LEFT, FTR_Y + 3, { lineBreak: false })
    doc.text(`Página ${pg} de ${tot}`, PAGE_W - LEFT - 100, FTR_Y + 3,
      { width: 100, align: 'right', lineBreak: false })
  }

  // ── Encabezado de tabla de datos ──────────────────────────────────────────
  const TH = 17
  function tableHeader(y: number) {
    doc.rect(LEFT, y, USABLE, TH).fill(C.green)
    doc.fillColor(C.white).fontSize(6.8).font('Helvetica-Bold')
    fields.forEach((f, i) => {
      doc.text(f.label.toUpperCase(), colX(i) + 3, y + 5,
        { width: colW[i] - 4, lineBreak: false })
    })
    doc.fillColor(C.ink).font('Helvetica')
    return y + TH
  }

  // ── Calcular paginación ───────────────────────────────────────────────────
  const ROW_H     = 13
  const AVAIL     = FTR_Y - CT - 4
  const RPP       = Math.floor((AVAIL - TH) / ROW_H)  // rows per page
  const dataPages = rows.length > 0 ? Math.ceil(rows.length / RPP) : 1
  totalPages      = 1 + dataPages  // pág resumen + páginas de datos

  // ══════════════════════════════════════════════════════════════════════════
  // PÁGINA 1 — RESUMEN EJECUTIVO
  // ══════════════════════════════════════════════════════════════════════════
  pageNum = 1
  doc.addPage()
  shell(pageNum, totalPages)

  const totUsd   = rows.reduce((s, r) => s + r.usdTotal, 0)
  const totGs    = rows.reduce((s, r) => s + r.montoGs, 0)
  const comGab   = rows.reduce((s, r) => s + r.montoComisionGabrielUsd, 0)
  const comCol   = rows.reduce((s, r) => s + r.montoColaboradorUsd, 0)
  const avgTasa  = rows.length ? rows.reduce((s, r) => s + r.tasaUsada, 0) / rows.length : 0

  // Título + underline accent
  const SY = CT + 2
  doc.fillColor(C.ink).fontSize(11).font('Helvetica-Bold')
    .text('RESUMEN EJECUTIVO', LEFT, SY, { lineBreak: false })
  doc.rect(LEFT, SY + 16, 108, 2).fill(C.accent)

  // ── 4 cards de métricas ───────────────────────────────────────────────────
  const CW = 181; const CH = 68; const CY = SY + 26; const CG = 8
  const cards = [
    { bg: C.cardA, label: 'TRANSACCIONES',  val: rows.length.toLocaleString('es-PY'), sub: 'registros en el período' },
    { bg: C.cardB, label: 'VOLUMEN USD',    val: `$${formatUsd(totUsd)}`,             sub: 'monto total operado'    },
    { bg: C.cardC, label: 'COM. GABRIEL',   val: `$${formatUsd(comGab)}`,             sub: 'comision acumulada USD' },
    { bg: C.cardD, label: 'GS ENTREGADOS',  val: formatGs(Math.round(totGs)),         sub: 'guaranies entregados'   },
  ]
  cards.forEach((c, i) => {
    const x = LEFT + i * (CW + CG)
    doc.rect(x, CY, CW, CH).fill(c.bg)
    doc.rect(x, CY, 3, CH).fill(C.accent)           // barra izquierda
    doc.fillColor(C.cardLabel).fontSize(6.5).font('Helvetica')
      .text(c.label, x + 10, CY + 10, { lineBreak: false })
    doc.fillColor(C.white).fontSize(18).font('Helvetica-Bold')
      .text(c.val, x + 10, CY + 22, { width: CW - 14, lineBreak: false })
    doc.fillColor(C.cardSub).fontSize(6).font('Helvetica')
      .text(c.sub, x + 10, CY + 48, { lineBreak: false })
  })

  // ── Fila de métricas secundarias ──────────────────────────────────────────
  const SMY  = CY + CH + 12
  const dias = (filtros.startDate && filtros.endDate)
    ? Math.max(1, Math.ceil((new Date(filtros.endDate).getTime() - new Date(filtros.startDate).getTime()) / 86400000) + 1)
    : null
  const smItems = [
    { label: 'Com. Colaboradores', val: `$${formatUsd(comCol)}` },
    { label: 'Tasa promedio',      val: `${formatGs(Math.round(avgTasa))} Gs/$` },
    { label: 'Periodo',            val: `${filtros.startDate ?? '-'}  a  ${filtros.endDate ?? '-'}` },
    { label: 'Transacciones / dia', val: dias ? (rows.length / dias).toFixed(1) : '-' },
  ]
  const SMW = USABLE / 4
  doc.rect(LEFT, SMY, USABLE, 0.5).fill(C.border)
  smItems.forEach((it, i) => {
    const x = LEFT + i * SMW
    doc.fillColor(C.muted).fontSize(6.8).font('Helvetica')
      .text(it.label, x, SMY + 7, { width: SMW - 6, lineBreak: false })
    doc.fillColor(C.ink).fontSize(10).font('Helvetica-Bold')
      .text(it.val, x, SMY + 18, { width: SMW - 6, lineBreak: false })
  })
  doc.rect(LEFT, SMY + 34, USABLE, 0.5).fill(C.border)

  // ── Tabla desglose por colaborador ────────────────────────────────────────
  const TBLY = SMY + 44
  doc.fillColor(C.ink).fontSize(8.5).font('Helvetica-Bold')
    .text('DESGLOSE POR COLABORADOR', LEFT, TBLY, { lineBreak: false })

  const byC = new Map<string, { txs: number; usd: number; gs: number; com: number; comG: number }>()
  rows.forEach(r => {
    const n = r.colaborador ?? 'Gabriel Zambrano'
    const v = byC.get(n) ?? { txs: 0, usd: 0, gs: 0, com: 0, comG: 0 }
    byC.set(n, { txs: v.txs + 1, usd: v.usd + r.usdTotal, gs: v.gs + r.montoGs,
                 com: v.com + r.montoColaboradorUsd, comG: v.comG + r.montoComisionGabrielUsd })
  })

  const CC  = [174, 88, 108, 112, 112, 122]  // anchos cols colaborador
  const CH2 = ['Colaborador', 'Transacciones', 'USD Movido', 'Com. Colaborador', 'Com. Gabriel', 'Gs Entregados']
  let cy = TBLY + 14

  doc.rect(LEFT, cy, USABLE, 16).fill(C.green)
  doc.fillColor(C.white).fontSize(7).font('Helvetica-Bold')
  CH2.forEach((h, i) => {
    const x = LEFT + CC.slice(0, i).reduce((s, w) => s + w, 0)
    doc.text(h, x + 4, cy + 4, { width: CC[i] - 6, lineBreak: false })
  })
  cy += 16

  let ri = 0
  byC.forEach((v, name) => {
    if (ri % 2 === 0) doc.rect(LEFT, cy, USABLE, 14).fill(C.rowAlt)
    doc.fillColor(C.ink).fontSize(7.5).font('Helvetica')
    const vals = [name, String(v.txs), `$${formatUsd(v.usd)}`,
                  `$${formatUsd(v.com)}`, `$${formatUsd(v.comG)}`,
                  `${formatGs(Math.round(v.gs))} Gs`]
    vals.forEach((val, i) => {
      const x = LEFT + CC.slice(0, i).reduce((s, w) => s + w, 0)
      doc.text(val, x + 4, cy + 3, { width: CC[i] - 6, lineBreak: false })
    })
    cy += 14; ri++
  })
  doc.rect(LEFT, cy, USABLE, 0.5).fill(C.border)

  // ══════════════════════════════════════════════════════════════════════════
  // PÁGINAS DE DATOS
  // ══════════════════════════════════════════════════════════════════════════
  let buf = 0
  let y   = CT

  rows.forEach((r, idx) => {
    if (buf === 0) {
      pageNum++
      doc.addPage()
      shell(pageNum, totalPages)
      y = CT
      y = tableHeader(y)
    }

    if (buf % 2 === 1) doc.rect(LEFT, y, USABLE, ROW_H).fill(C.rowAlt)
    doc.fillColor(C.ink).fontSize(7).font('Helvetica')
    fields.forEach((f, i) => {
      doc.text(String(getFieldValue(r, f.key)), colX(i) + 3, y + 3,
        { width: colW[i] - 5, lineBreak: false })
    })

    y += ROW_H; buf++
    if (buf >= RPP) buf = 0
    if (idx % 5 === 4) doc.rect(LEFT, y, USABLE, 0.3).fill(C.border)
  })

  doc.end()
  await new Promise<void>(resolve => doc.on('end', resolve))
  return Buffer.concat(chunks)
}
