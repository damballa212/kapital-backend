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
  const rows = await findTransactionsForExport(filtros)
  const fields = resolveFields(filtros.fields)
  const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))

  const GREEN  = [26, 92, 56]   as [number, number, number]
  const WHITE  = [255, 255, 255] as [number, number, number]
  const GRAY   = [245, 247, 245] as [number, number, number]
  const W      = 769  // usable width landscape A4
  const LEFT   = 36

  function drawHeader(page: number, total: number) {
    // fondo verde
    doc.rect(0, 0, doc.page.width, 56).fill(`rgb(${GREEN.join(',')})`)
    doc.fillColor(`rgb(${WHITE.join(',')})`)
      .fontSize(18).font('Helvetica-Bold')
      .text('KONTIGO · Casa de Cambios', LEFT, 14)
    doc.fontSize(9).font('Helvetica')
      .text(`Reporte de Transacciones · Generado: ${new Date().toLocaleString('es-PY', { timeZone: TZ })}`, LEFT, 36)
    doc.text(`Página ${page} de ${total}`, W - 60, 36, { align: 'right' })
    doc.fillColor('black')
  }

  // calcular páginas necesarias
  const rowsPerPage = 28
  const totalPages  = Math.ceil(rows.length / rowsPerPage) + 1 // +1 resumen

  // ── Página(s) de datos ──
  const colW = Math.floor(W / fields.length)
  let pageNum = 1

  function drawTableHeader(y: number) {
    doc.rect(LEFT, y, W, 16).fill(`rgb(${GREEN.join(',')})`)
    doc.fillColor(`rgb(${WHITE.join(',')})`)
      .fontSize(7).font('Helvetica-Bold')
    fields.forEach((f, i) => {
      doc.text(f.label, LEFT + i * colW, y + 4, { width: colW - 2, lineBreak: false })
    })
    doc.fillColor('black').font('Helvetica')
    return y + 18
  }

  drawHeader(pageNum, totalPages)
  let y = 68
  y = drawTableHeader(y)

  rows.forEach((r, idx) => {
    if (idx > 0 && idx % rowsPerPage === 0) {
      doc.addPage()
      pageNum++
      drawHeader(pageNum, totalPages)
      y = 68
      y = drawTableHeader(y)
    }
    if (idx % 2 === 0) doc.rect(LEFT, y, W, 14).fill(`rgb(${GRAY.join(',')})`)
    doc.fillColor('black').fontSize(7).font('Helvetica')
    fields.forEach((f, i) => {
      const v = getFieldValue(r, f.key)
      doc.text(String(v), LEFT + i * colW, y + 3, { width: colW - 2, lineBreak: false })
    })
    y += 14
  })

  // ── Página de resumen ejecutivo ──
  doc.addPage()
  pageNum++
  drawHeader(pageNum, totalPages)

  const totalUsd = rows.reduce((s, r) => s + r.usdTotal, 0)
  const totalGs  = rows.reduce((s, r) => s + r.montoGs, 0)
  const comGab   = rows.reduce((s, r) => s + r.montoComisionGabrielUsd, 0)
  const comColab = rows.reduce((s, r) => s + r.montoColaboradorUsd, 0)

  doc.fontSize(13).font('Helvetica-Bold').fillColor('black')
    .text('RESUMEN EJECUTIVO', LEFT, 72)
  doc.moveDown(0.5)

  // 4 cards
  const cards = [
    { label: 'Transacciones', value: String(rows.length), color: GREEN },
    { label: 'USD Movido',    value: `$${formatUsd(totalUsd)}`, color: [30, 80, 160] as [number, number, number] },
    { label: 'Com. Gabriel',  value: `$${formatUsd(comGab)}`,   color: [120, 40, 160] as [number, number, number] },
    { label: 'Com. Colabs',   value: `$${formatUsd(comColab)}`, color: [160, 80, 20] as [number, number, number] },
  ]
  const cardW = 176; const cardH = 56; const cardY = 100
  cards.forEach((c, i) => {
    const x = LEFT + i * (cardW + 10)
    doc.rect(x, cardY, cardW, cardH).fill(`rgb(${c.color.join(',')})`)
    doc.fillColor('white').fontSize(8).font('Helvetica').text(c.label, x + 10, cardY + 8)
    doc.fontSize(18).font('Helvetica-Bold').text(c.value, x + 10, cardY + 22, { width: cardW - 20 })
  })

  // tabla por colaborador
  doc.fillColor('black').fontSize(11).font('Helvetica-Bold')
    .text('Performance por Colaborador', LEFT, 175)
  const byColab = new Map<string, { txs: number; usd: number; com: number }>()
  rows.forEach(r => {
    const name = r.colaborador ?? 'Gabriel Zambrano'
    const cur = byColab.get(name) ?? { txs: 0, usd: 0, com: 0 }
    byColab.set(name, { txs: cur.txs + 1, usd: cur.usd + r.usdTotal, com: cur.com + r.montoColaboradorUsd })
  })

  let cy = 192
  doc.rect(LEFT, cy, W, 14).fill(`rgb(${GREEN.join(',')})`)
  doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
  ;['Colaborador', 'Transacciones', 'USD Movido', 'Comisión USD', 'Gs entregados'].forEach((h, i) => {
    doc.text(h, LEFT + i * 150, cy + 3, { width: 148, lineBreak: false })
  })
  cy += 16
  byColab.forEach((v, name) => {
    doc.rect(LEFT, cy, W, 13).fill(GRAY)
    doc.fillColor('black').fontSize(8).font('Helvetica')
    const gsCol = rows.filter(r => (r.colaborador ?? 'Gabriel Zambrano') === name).reduce((s, r) => s + r.montoGs, 0)
    ;[name, String(v.txs), `$${formatUsd(v.usd)}`, `$${formatUsd(v.com)}`, formatGs(gsCol) + ' Gs'].forEach((val, i) => {
      doc.text(val, LEFT + i * 150, cy + 3, { width: 148, lineBreak: false })
    })
    cy += 14
  })

  doc.end()
  await new Promise<void>(resolve => doc.on('end', resolve))
  return Buffer.concat(chunks)
}
