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
  const rows  = await findTransactionsForExport(filtros)
  const fields = resolveFields(filtros.fields)

  // ── Paleta corporativa ────────────────────────────────────────────────────
  type RGB = [number, number, number]
  const C = {
    ink:        [13,  17,  23]  as RGB,  // texto principal
    deepGreen:  [8,   42,  22]  as RGB,  // header bg
    green:      [26,  92,  56]  as RGB,  // acentos tabla
    accentLine: [46, 184,  92]  as RGB,  // línea decorativa bajo header
    rowAlt:     [240, 249, 244] as RGB,  // fila alternada
    borderLine: [210, 228, 218] as RGB,  // separadores
    mutedText:  [100, 120, 110] as RGB,  // texto secundario
    white:      [255, 255, 255] as RGB,
    // métricas cards
    cardBlue:   [12,  52,  96]  as RGB,
    cardSlate:  [30,  35,  50]  as RGB,
    cardEarth:  [60,  38,  16]  as RGB,
  }
  const rgb = (c: RGB) => `rgb(${c.join(',')})`

  // ── Dimensiones ───────────────────────────────────────────────────────────
  const PAGE_W = 841.89
  const PAGE_H = 595.28
  const LEFT   = 40
  const USABLE = PAGE_W - LEFT * 2   // 762
  const HDR_H  = 68
  const FTR_Y  = PAGE_H - 28
  const CONTENT_TOP = HDR_H + 14

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, autoFirstPage: false })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))

  // ── Cálculo de anchos de columna ──────────────────────────────────────────
  const PREF: Record<string, number> = {
    id: 32, fecha: 68, cliente: 100, colaborador: 82, usd_total: 58,
    comision: 44, usd_neto: 58, monto_gs: 64, com_colaborador_usd: 72,
    com_gabriel_usd: 72, com_colaborador_gs: 72, com_gabriel_gs: 72,
    tasa_usada: 58, observaciones: 90,
  }
  const totalPref = fields.reduce((s, f) => s + (PREF[f.key] ?? 60), 0)
  const colWidths = fields.map(f => Math.floor((PREF[f.key] ?? 60) / totalPref * USABLE))

  function colX(i: number) { return LEFT + colWidths.slice(0, i).reduce((s, w) => s + w, 0) }

  // ── Helpers de página ─────────────────────────────────────────────────────
  let pageNum = 0
  let totalPages = 0

  function drawPageShell(pg: number, total: number) {
    // header bg
    doc.rect(0, 0, PAGE_W, HDR_H).fill(rgb(C.deepGreen))
    // línea de acento bajo header
    doc.rect(0, HDR_H, PAGE_W, 3).fill(rgb(C.accentLine))

    // logo area — rectángulo blanco con "K"
    doc.rect(LEFT, 12, 44, 44).fill(rgb(C.green))
    doc.fillColor(rgb(C.white)).fontSize(22).font('Helvetica-Bold')
      .text('K', LEFT, 18, { width: 44, align: 'center', lineBreak: false })

    // título
    doc.fillColor(rgb(C.white)).fontSize(17).font('Helvetica-Bold')
      .text('KONTIGO', LEFT + 54, 15, { lineBreak: false })
    doc.fontSize(8).font('Helvetica')
      .text('Casa de Cambios  ·  Reporte de Transacciones', LEFT + 54, 36, { lineBreak: false })

    // fecha generación — derecha
    const genDate = new Date().toLocaleString('es-PY', { timeZone: TZ })
    doc.fontSize(7).fillColor(rgb(C.accentLine))
      .text(`Generado: ${genDate}`, PAGE_W - LEFT - 160, 20, { width: 160, align: 'right', lineBreak: false })
    doc.fillColor(rgb(C.white))
      .text(`Página ${pg} / ${total}`, PAGE_W - LEFT - 160, 33, { width: 160, align: 'right', lineBreak: false })

    // footer
    doc.rect(LEFT, FTR_Y - 1, USABLE, 0.5).fill(rgb(C.borderLine))
    doc.fillColor(rgb(C.mutedText)).fontSize(6.5).font('Helvetica')
      .text('KONTIGO · Documento Confidencial · Uso Interno', LEFT, FTR_Y + 4, { lineBreak: false })
    doc.text(`${pg} / ${total}`, PAGE_W - LEFT - 60, FTR_Y + 4,
      { width: 60, align: 'right', lineBreak: false })
  }

  function drawTableHeader(y: number): number {
    const rowH = 18
    doc.rect(LEFT, y, USABLE, rowH).fill(rgb(C.green))
    doc.fillColor(rgb(C.white)).fontSize(7).font('Helvetica-Bold')
    fields.forEach((f, i) => {
      doc.text(f.label.toUpperCase(), colX(i) + 3, y + 5,
        { width: colWidths[i] - 4, lineBreak: false })
    })
    doc.fillColor(rgb(C.ink)).font('Helvetica')
    return y + rowH
  }

  // ── Calcular total de páginas ─────────────────────────────────────────────
  const ROW_H       = 13
  const AVAIL_H     = FTR_Y - CONTENT_TOP - 6  // ~479
  const ROWS_PER_P  = Math.floor((AVAIL_H - 18) / ROW_H)  // ~35
  const dataPages   = rows.length > 0 ? Math.ceil(rows.length / ROWS_PER_P) : 1
  totalPages        = 1 + dataPages  // 1 resumen + data pages

  // ══════════════════════════════════════════════════════════════════════════
  // PÁGINA 1 — RESUMEN EJECUTIVO
  // ══════════════════════════════════════════════════════════════════════════
  pageNum = 1
  doc.addPage()
  drawPageShell(pageNum, totalPages)

  const totalUsd  = rows.reduce((s, r) => s + r.usdTotal, 0)
  const totalGs   = rows.reduce((s, r) => s + r.montoGs, 0)
  const comGab    = rows.reduce((s, r) => s + r.montoComisionGabrielUsd, 0)
  const comColab  = rows.reduce((s, r) => s + r.montoColaboradorUsd, 0)
  const avgTasa   = rows.length ? rows.reduce((s, r) => s + r.tasaUsada, 0) / rows.length : 0

  // título sección
  const sy = CONTENT_TOP + 4
  doc.fillColor(rgb(C.ink)).fontSize(13).font('Helvetica-Bold')
    .text('RESUMEN EJECUTIVO', LEFT, sy)
  doc.rect(LEFT, sy + 18, 120, 2).fill(rgb(C.accentLine))

  // ── 4 métricas principales ────────────────────────────────────────────────
  const CARD_W = 178; const CARD_H = 70; const CARD_Y = sy + 30; const CARD_GAP = 10
  const metricCards = [
    { label: 'TRANSACCIONES',   value: rows.length.toLocaleString('es-PY'), sub: 'registros en el período', color: C.deepGreen },
    { label: 'VOLUMEN USD',      value: `$${formatUsd(totalUsd)}`,            sub: 'monto total operado',     color: C.cardBlue  },
    { label: 'COM. GABRIEL',     value: `$${formatUsd(comGab)}`,              sub: 'comisión acumulada USD',  color: C.green     },
    { label: 'GS ENTREGADOS',    value: formatGs(totalGs),                    sub: 'guaraníes entregados',    color: C.cardSlate },
  ]
  metricCards.forEach((c, i) => {
    const x = LEFT + i * (CARD_W + CARD_GAP)
    // sombra sutil
    doc.rect(x + 2, CARD_Y + 2, CARD_W, CARD_H).fill('rgba(0,0,0,0.08)')
    doc.rect(x, CARD_Y, CARD_W, CARD_H).fill(rgb(c.color))
    // barra acento izquierda
    doc.rect(x, CARD_Y, 4, CARD_H).fill(rgb(C.accentLine))
    doc.fillColor(rgb(C.accentLine)).fontSize(7).font('Helvetica')
      .text(c.label, x + 12, CARD_Y + 10, { lineBreak: false })
    doc.fillColor(rgb(C.white)).fontSize(19).font('Helvetica-Bold')
      .text(c.value, x + 12, CARD_Y + 22, { width: CARD_W - 16, lineBreak: false })
    doc.fillColor('rgba(255,255,255,0.5)').fontSize(6.5).font('Helvetica')
      .text(c.sub, x + 12, CARD_Y + 48, { lineBreak: false })
  })

  // ── fila adicional de métricas ─────────────────────────────────────────────
  const SM_Y = CARD_Y + CARD_H + 14
  const smItems = [
    { label: 'Com. Colaboradores', value: `$${formatUsd(comColab)}` },
    { label: 'Tasa promedio',      value: `${formatGs(Math.round(avgTasa))} Gs/$` },
    { label: 'Período',            value: `${filtros.startDate ?? '—'} → ${filtros.endDate ?? '—'}` },
    { label: 'Transac. / día',     value: filtros.startDate && filtros.endDate
      ? (rows.length / Math.max(1, Math.ceil((new Date(filtros.endDate).getTime() - new Date(filtros.startDate).getTime()) / 86400000) + 1)).toFixed(1)
      : '—'
    },
  ]
  const smW = USABLE / smItems.length
  doc.rect(LEFT, SM_Y, USABLE, 0.5).fill(rgb(C.borderLine))
  smItems.forEach((item, i) => {
    const x = LEFT + i * smW
    doc.fillColor(rgb(C.mutedText)).fontSize(7).font('Helvetica')
      .text(item.label, x, SM_Y + 8, { lineBreak: false })
    doc.fillColor(rgb(C.ink)).fontSize(11).font('Helvetica-Bold')
      .text(item.value, x, SM_Y + 18, { width: smW - 8, lineBreak: false })
  })
  doc.rect(LEFT, SM_Y + 36, USABLE, 0.5).fill(rgb(C.borderLine))

  // ── tabla desglose por colaborador ────────────────────────────────────────
  const TBL_Y = SM_Y + 46
  doc.fillColor(rgb(C.ink)).fontSize(9).font('Helvetica-Bold')
    .text('DESGLOSE POR COLABORADOR', LEFT, TBL_Y)

  const byColab = new Map<string, { txs: number; usd: number; gs: number; com: number; comG: number }>()
  rows.forEach(r => {
    const name = r.colaborador ?? 'Gabriel Zambrano'
    const cur  = byColab.get(name) ?? { txs: 0, usd: 0, gs: 0, com: 0, comG: 0 }
    byColab.set(name, {
      txs: cur.txs + 1,
      usd: cur.usd + r.usdTotal,
      gs:  cur.gs  + r.montoGs,
      com: cur.com + r.montoColaboradorUsd,
      comG: cur.comG + r.montoComisionGabrielUsd,
    })
  })

  const COLAB_COLS = [180, 90, 110, 110, 110, 110]
  const COLAB_HDRS = ['Colaborador', 'Transacciones', 'USD Movido', 'Com. Colaborador', 'Com. Gabriel', 'Gs Entregados']
  let cy = TBL_Y + 14

  // header tabla
  doc.rect(LEFT, cy, USABLE, 15).fill(rgb(C.deepGreen))
  doc.fillColor(rgb(C.white)).fontSize(7).font('Helvetica-Bold')
  COLAB_HDRS.forEach((h, i) => {
    const x = LEFT + COLAB_COLS.slice(0, i).reduce((s, w) => s + w, 0)
    doc.text(h, x + 4, cy + 4, { width: COLAB_COLS[i] - 6, lineBreak: false })
  })
  cy += 15

  let rowIdx = 0
  byColab.forEach((v, name) => {
    if (rowIdx % 2 === 0) doc.rect(LEFT, cy, USABLE, 14).fill(rgb(C.rowAlt))
    doc.fillColor(rgb(C.ink)).fontSize(7.5).font('Helvetica')
    const vals = [
      name,
      v.txs.toString(),
      `$${formatUsd(v.usd)}`,
      `$${formatUsd(v.com)}`,
      `$${formatUsd(v.comG)}`,
      `${formatGs(Math.round(v.gs))} Gs`,
    ]
    vals.forEach((val, i) => {
      const x = LEFT + COLAB_COLS.slice(0, i).reduce((s, w) => s + w, 0)
      doc.text(val, x + 4, cy + 3, { width: COLAB_COLS[i] - 6, lineBreak: false })
    })
    cy += 14
    rowIdx++
  })
  doc.rect(LEFT, cy, USABLE, 0.5).fill(rgb(C.borderLine))

  // ══════════════════════════════════════════════════════════════════════════
  // PÁGINAS DE DATOS
  // ══════════════════════════════════════════════════════════════════════════
  let rowBuf = 0
  let y      = CONTENT_TOP

  rows.forEach((r, idx) => {
    if (rowBuf === 0) {
      pageNum++
      doc.addPage()
      drawPageShell(pageNum, totalPages)
      y = CONTENT_TOP
      y = drawTableHeader(y)
    }

    if (rowBuf % 2 === 1) doc.rect(LEFT, y, USABLE, ROW_H).fill(rgb(C.rowAlt))
    doc.fillColor(rgb(C.ink)).fontSize(7).font('Helvetica')
    fields.forEach((f, i) => {
      const v = getFieldValue(r, f.key)
      doc.text(String(v), colX(i) + 3, y + 3,
        { width: colWidths[i] - 5, lineBreak: false })
    })

    y += ROW_H
    rowBuf++
    if (rowBuf >= ROWS_PER_P) rowBuf = 0

    // línea separadora sutil cada 5 filas
    if (idx % 5 === 4) doc.rect(LEFT, y, USABLE, 0.3).fill(rgb(C.borderLine))
  })

  doc.end()
  await new Promise<void>(resolve => doc.on('end', resolve))
  return Buffer.concat(chunks)
}
