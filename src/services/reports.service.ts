import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { findTransactionsForExport } from '../repositories/transaction.repository.js'
import type { FiltroReporte, Transaction } from '../domain/transaction.js'
import { formatGs, formatUsd, formatPct } from '../utils/formatters.js'

export async function generarCSV(filtros: FiltroReporte): Promise<string> {
  const rows = await findTransactionsForExport(filtros)
  const headers = [
    'ID', 'Fecha', 'Cliente', 'Colaborador', 'USD Total', 'Comisión %',
    'USD Neto', 'Monto Gs', 'Comisión Colaborador USD', 'Comisión Gabriel USD', 'Tasa Usada',
  ]
  const lines = [
    headers.join(','),
    ...rows.map(r => [
      r.id,
      r.fecha.toISOString(),
      `"${r.cliente}"`,
      `"${r.colaborador ?? ''}"`,
      formatUsd(r.usdTotal),
      formatPct(r.comision),
      formatUsd(r.usdNeto),
      formatGs(r.montoGs),
      formatUsd(r.montoColaboradorUsd),
      formatUsd(r.montoComisionGabrielUsd),
      formatUsd(r.tasaUsada),
    ].join(',')),
  ]
  return lines.join('\n')
}

export async function generarExcel(filtros: FiltroReporte): Promise<Buffer> {
  const rows = await findTransactionsForExport(filtros)
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Transacciones')

  ws.columns = [
    { header: 'ID',             key: 'id',       width: 8 },
    { header: 'Fecha',          key: 'fecha',    width: 20 },
    { header: 'Cliente',        key: 'cliente',  width: 25 },
    { header: 'Colaborador',    key: 'col',      width: 20 },
    { header: 'USD Total',      key: 'usdTotal', width: 12 },
    { header: 'Comisión %',     key: 'comision', width: 12 },
    { header: 'USD Neto',       key: 'usdNeto',  width: 12 },
    { header: 'Monto Gs',       key: 'montoGs',  width: 15 },
    { header: 'Com. Colab USD', key: 'colUsd',   width: 14 },
    { header: 'Com. Gabriel USD', key: 'gabUsd', width: 16 },
    { header: 'Tasa Usada',     key: 'tasa',     width: 12 },
  ]

  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

  rows.forEach((r, i) => {
    const row = ws.addRow({
      id: r.id,
      fecha: r.fecha.toISOString().replace('T', ' ').slice(0, 19),
      cliente: r.cliente,
      col: r.colaborador ?? '',
      usdTotal: r.usdTotal,
      comision: r.comision,
      usdNeto: r.usdNeto,
      montoGs: r.montoGs,
      colUsd: r.montoColaboradorUsd,
      gabUsd: r.montoComisionGabrielUsd,
      tasa: r.tasaUsada,
    })
    if (i % 2 === 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } }
    }
  })

  const totalsRow = ws.addRow({
    id: 'TOTAL',
    usdTotal: rows.reduce((s, r) => s + r.usdTotal, 0),
    usdNeto: rows.reduce((s, r) => s + r.usdNeto, 0),
    montoGs: rows.reduce((s, r) => s + r.montoGs, 0),
    colUsd: rows.reduce((s, r) => s + r.montoColaboradorUsd, 0),
    gabUsd: rows.reduce((s, r) => s + r.montoComisionGabrielUsd, 0),
  })
  totalsRow.font = { bold: true }

  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>
}

export async function generarPDF(filtros: FiltroReporte): Promise<Buffer> {
  const rows = await findTransactionsForExport(filtros)
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' })
  const chunks: Buffer[] = []

  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  await new Promise<void>((resolve) => {
    doc.on('end', resolve)

    doc.fontSize(16).text('Kapital App — Reporte de Transacciones', { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(10).text(`Generado: ${new Date().toLocaleString('es-PY')}`, { align: 'center' })
    doc.moveDown(1)

    const cols = [40, 130, 220, 320, 400, 460, 530, 600]
    const headers = ['ID', 'Fecha', 'Cliente', 'Colaborador', 'USD Total', 'Comisión', 'USD Neto', 'Monto Gs']

    doc.fontSize(9).font('Helvetica-Bold')
    headers.forEach((h, i) => doc.text(h, cols[i], doc.y, { width: 80, lineBreak: false }))
    doc.moveDown(0.5)
    doc.moveTo(40, doc.y).lineTo(800, doc.y).stroke()
    doc.moveDown(0.3)

    doc.font('Helvetica')
    rows.forEach((r) => {
      if (doc.y > 520) {
        doc.addPage()
        doc.fontSize(9).font('Helvetica-Bold')
        headers.forEach((h, i) => doc.text(h, cols[i], doc.y, { width: 80, lineBreak: false }))
        doc.moveDown(0.5)
        doc.font('Helvetica')
      }
      const y = doc.y
      const values = [
        String(r.id),
        r.fecha.toISOString().slice(0, 10),
        r.cliente,
        r.colaborador ?? '',
        `$${formatUsd(r.usdTotal)}`,
        formatPct(r.comision),
        `$${formatUsd(r.usdNeto)}`,
        formatGs(r.montoGs),
      ]
      values.forEach((v, i) => doc.text(v, cols[i], y, { width: 80, lineBreak: false }))
      doc.moveDown(0.5)
    })

    doc.end()
  })

  return Buffer.concat(chunks)
}
