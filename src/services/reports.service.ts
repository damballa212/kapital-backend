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

// ── PDF — A4 Landscape, diseño ejecutivo corporativo ─────────────────────────
export async function generarPDF(filtros: FiltroReporte): Promise<Buffer> {
  const rows   = await findTransactionsForExport(filtros)
  const fields = resolveFields(filtros.fields)

  // ── Paleta (solo hex — PDFKit no acepta rgb()/rgba()) ─────────────────────
  const HDR_BG  = '#0B2016'   // header oscuro
  const GREEN   = '#1A5C38'   // tabla headers, acentos principales
  const ACCENT  = '#27AE60'   // stripe, underline
  const CARD_BG = '#F6FBF7'   // fondo de cards (muy claro)
  const ROW_BG  = '#F2F8F4'   // fila alternada
  const BORDER  = '#C8DDD1'   // líneas separadoras
  const MUTED   = '#6A8A78'   // texto secundario
  const INK     = '#0E1912'   // texto principal
  const WHITE   = '#FFFFFF'
  const HDRSUB  = '#99BBA8'   // subtítulo en header
  const HDRDATE = '#70A087'   // fecha en header

  // borde izquierdo de cada card — colores distintos y reconocibles
  const CA1 = '#1A5C38'   // verde
  const CA2 = '#1A3F72'   // azul marino
  const CA3 = '#8B4513'   // cobre / tierra
  const CA4 = '#4A1A7A'   // violeta

  // ── Dimensiones A4 landscape ──────────────────────────────────────────────
  const PW   = 841.89
  const PH   = 595.28
  const L    = 42        // left/right margin
  const W    = PW - L*2  // usable width ≈ 758
  const HDRH = 62        // header height
  const FTRY = PH - 24   // footer y
  const CT   = HDRH + 14 // content top

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, autoFirstPage: false })
  const chunks: Buffer[] = []
  doc.on('data', (b: Buffer) => chunks.push(b))

  // ── Anchos de columna proporcionales por tipo de dato ─────────────────────
  const PREF: Record<string, number> = {
    id: 30, fecha: 70, cliente: 98, colaborador: 82, usd_total: 58,
    comision: 44, usd_neto: 58, monto_gs: 65, com_colaborador_usd: 72,
    com_gabriel_usd: 72, com_colaborador_gs: 72, com_gabriel_gs: 72,
    tasa_usada: 58, observaciones: 90,
  }
  const prefSum = fields.reduce((s, f) => s + (PREF[f.key] ?? 60), 0)
  const colW    = fields.map(f => Math.floor((PREF[f.key] ?? 60) / prefSum * W))
  const cx      = (i: number) => L + colW.slice(0, i).reduce((s, v) => s + v, 0)

  let pageNum    = 0
  let totalPages = 0

  // ── Shell (header + footer) en cada página ────────────────────────────────
  function shell(pg: number, tot: number) {
    doc.rect(0, 0, PW, HDRH).fill(HDR_BG)
    doc.rect(0, HDRH, PW, 4).fill(ACCENT)

    doc.rect(L, 10, 42, 42).fill(GREEN)
    doc.fillColor(WHITE).fontSize(22).font('Helvetica-Bold')
      .text('K', L, 16, { width: 42, align: 'center', lineBreak: false })

    doc.fillColor(WHITE).fontSize(19).font('Helvetica-Bold')
      .text('KONTIGO', L + 52, 11, { lineBreak: false })
    doc.fillColor(HDRSUB).fontSize(8.5).font('Helvetica')
      .text('Casa de Cambios  ·  Reporte de Transacciones', L + 52, 33, { lineBreak: false })

    const gen = new Date().toLocaleString('es-PY', { timeZone: TZ })
    doc.fillColor(HDRDATE).fontSize(7.5).font('Helvetica')
      .text(`Generado  ${gen}`, PW - L - 220, 15, { width: 220, align: 'right', lineBreak: false })
    doc.fillColor(WHITE).fontSize(9).font('Helvetica-Bold')
      .text(`${pg}  /  ${tot}`, PW - L - 220, 30, { width: 220, align: 'right', lineBreak: false })

    doc.rect(L, FTRY - 1, W, 0.5).fill(BORDER)
    doc.fillColor(MUTED).fontSize(7).font('Helvetica')
      .text('KONTIGO  ·  Documento Confidencial  ·  Uso Interno', L, FTRY + 4, { lineBreak: false })
    doc.text(`Pagina ${pg} de ${tot}`, PW - L - 110, FTRY + 4, { width: 110, align: 'right', lineBreak: false })
  }

  // ── Encabezado de tabla ───────────────────────────────────────────────────
  const TH_H = 20
  function tableHeader(y: number) {
    doc.rect(L, y, W, TH_H).fill(GREEN)
    doc.fillColor(WHITE).fontSize(7.5).font('Helvetica-Bold')
    fields.forEach((f, i) => {
      doc.text(f.label.toUpperCase(), cx(i) + 4, y + 6, { width: colW[i] - 6, lineBreak: false })
    })
    doc.fillColor(INK).font('Helvetica')
    return y + TH_H
  }

  // ── Calcular paginación ───────────────────────────────────────────────────
  const ROW_H    = 16
  const AVAIL    = FTRY - CT - 8
  const RPP      = Math.floor((AVAIL - TH_H) / ROW_H)
  const dataPgs  = rows.length > 0 ? Math.ceil(rows.length / RPP) : 1
  totalPages     = 1 + dataPgs

  // ══════════════════════════════════════════════════════════════════════════
  // PÁGINA 1 — RESUMEN EJECUTIVO
  // ══════════════════════════════════════════════════════════════════════════
  pageNum = 1
  doc.addPage()
  shell(pageNum, totalPages)

  const totUsd  = rows.reduce((s, r) => s + r.usdTotal, 0)
  const totGs   = rows.reduce((s, r) => s + r.montoGs, 0)
  const comGab  = rows.reduce((s, r) => s + r.montoComisionGabrielUsd, 0)
  const comCol  = rows.reduce((s, r) => s + r.montoColaboradorUsd, 0)
  const avgTasa = rows.length ? rows.reduce((s, r) => s + r.tasaUsada, 0) / rows.length : 0

  const SY = CT + 6
  doc.fillColor(INK).fontSize(12).font('Helvetica-Bold')
    .text('RESUMEN EJECUTIVO', L, SY, { lineBreak: false })
  doc.rect(L, SY + 18, 110, 3).fill(ACCENT)

  // ── 4 cards: fondo claro + borde izquierdo de color + número grande ───────
  const CW = (W - 24) / 4    // ≈ 183
  const CH = 74
  const CY = SY + 28
  const cardDefs = [
    { accent: CA1, label: 'TRANSACCIONES', val: rows.length.toLocaleString('es-PY'), sub: 'registros en el periodo' },
    { accent: CA2, label: 'VOLUMEN USD',   val: `$${formatUsd(totUsd)}`,             sub: 'monto total operado'    },
    { accent: CA3, label: 'COM. GABRIEL',  val: `$${formatUsd(comGab)}`,             sub: 'comision acumulada USD' },
    { accent: CA4, label: 'GS ENTREGADOS', val: formatGs(Math.round(totGs)),         sub: 'guaranies entregados'   },
  ]
  cardDefs.forEach((c, i) => {
    const x = L + i * (CW + 8)
    doc.rect(x, CY, CW, CH).fill(CARD_BG)        // fondo claro
    doc.rect(x, CY, 5, CH).fill(c.accent)         // borde izquierdo color
    doc.fillColor(MUTED).fontSize(7).font('Helvetica')
      .text(c.label, x + 13, CY + 10, { lineBreak: false })
    doc.fillColor(INK).fontSize(21).font('Helvetica-Bold')
      .text(c.val, x + 13, CY + 21, { width: CW - 18, lineBreak: false })
    doc.fillColor(MUTED).fontSize(7).font('Helvetica')
      .text(c.sub, x + 13, CY + 53, { lineBreak: false })
  })

  // ── Métricas secundarias ──────────────────────────────────────────────────
  const SMY  = CY + CH + 14
  const dias = (filtros.startDate && filtros.endDate)
    ? Math.max(1, Math.ceil((new Date(filtros.endDate).getTime() - new Date(filtros.startDate).getTime()) / 86400000) + 1)
    : null
  const smItems = [
    { label: 'Com. Colaboradores', val: `$${formatUsd(comCol)}` },
    { label: 'Tasa promedio',      val: `${formatGs(Math.round(avgTasa))} Gs/$` },
    { label: 'Periodo',            val: `${filtros.startDate ?? '-'}  al  ${filtros.endDate ?? '-'}` },
    { label: 'Transac. / dia',     val: dias ? (rows.length / dias).toFixed(1) : '-' },
  ]
  doc.rect(L, SMY, W, 0.5).fill(BORDER)
  const SMW = W / 4
  smItems.forEach((it, i) => {
    const x = L + i * SMW
    doc.fillColor(MUTED).fontSize(7.5).font('Helvetica')
      .text(it.label, x, SMY + 7, { width: SMW - 6, lineBreak: false })
    doc.fillColor(INK).fontSize(12).font('Helvetica-Bold')
      .text(it.val, x, SMY + 19, { width: SMW - 6, lineBreak: false })
  })
  doc.rect(L, SMY + 38, W, 0.5).fill(BORDER)

  // ── Tabla desglose colaboradores ──────────────────────────────────────────
  const TBLY = SMY + 50
  doc.fillColor(INK).fontSize(9).font('Helvetica-Bold')
    .text('DESGLOSE POR COLABORADOR', L, TBLY, { lineBreak: false })

  const byC = new Map<string, { txs: number; usd: number; gs: number; com: number; comG: number }>()
  rows.forEach(r => {
    const n = r.colaborador ?? 'Gabriel Zambrano'
    const v = byC.get(n) ?? { txs: 0, usd: 0, gs: 0, com: 0, comG: 0 }
    byC.set(n, { txs: v.txs + 1, usd: v.usd + r.usdTotal, gs: v.gs + r.montoGs,
                 com: v.com + r.montoColaboradorUsd, comG: v.comG + r.montoComisionGabrielUsd })
  })
  const CC   = [192, 88, 118, 118, 118, 118]
  const CHDR = ['Colaborador', 'Transacciones', 'USD Movido', 'Com. Colaborador', 'Com. Gabriel', 'Gs Entregados']
  let cy = TBLY + 14

  doc.rect(L, cy, W, 18).fill(GREEN)
  doc.fillColor(WHITE).fontSize(8).font('Helvetica-Bold')
  CHDR.forEach((h, i) => {
    const x = L + CC.slice(0, i).reduce((s, v) => s + v, 0)
    doc.text(h, x + 5, cy + 5, { width: CC[i] - 8, lineBreak: false })
  })
  cy += 18
  let ri = 0
  byC.forEach((v, name) => {
    if (ri % 2 === 0) doc.rect(L, cy, W, 15).fill(ROW_BG)
    doc.fillColor(INK).fontSize(8.5).font('Helvetica')
    const vals = [name, String(v.txs), `$${formatUsd(v.usd)}`,
                  `$${formatUsd(v.com)}`, `$${formatUsd(v.comG)}`,
                  `${formatGs(Math.round(v.gs))} Gs`]
    vals.forEach((val, i) => {
      const x = L + CC.slice(0, i).reduce((s, v) => s + v, 0)
      doc.text(val, x + 5, cy + 4, { width: CC[i] - 8, lineBreak: false })
    })
    cy += 15; ri++
  })
  doc.rect(L, cy, W, 0.5).fill(BORDER)

  // ══════════════════════════════════════════════════════════════════════════
  // PÁGINAS DE DATOS (A4 landscape, fuente 8.5pt, 16pt por fila)
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

    if (buf % 2 === 1) doc.rect(L, y, W, ROW_H).fill(ROW_BG)
    doc.fillColor(INK).fontSize(8.5).font('Helvetica')
    fields.forEach((f, i) => {
      doc.text(String(getFieldValue(r, f.key)), cx(i) + 4, y + 4,
        { width: colW[i] - 6, lineBreak: false })
    })
    y += ROW_H; buf++
    if (buf >= RPP) buf = 0
    if (idx % 5 === 4) doc.rect(L, y, W, 0.3).fill(BORDER)
  })

  doc.end()
  await new Promise<void>(resolve => doc.on('end', resolve))
  return Buffer.concat(chunks)
}
