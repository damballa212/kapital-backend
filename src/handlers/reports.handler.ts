
import type { Request, Response } from 'express'
import { generarCSV, generarExcel, generarPDF } from '../services/reports.service.js'
import { getExportPreview } from '../repositories/transaction.repository.js'
import type { FiltroReporte } from '../domain/transaction.js'

export async function handleExportPreview(req: Request, res: Response): Promise<void> {
  const { startDate, endDate, colaborador, cliente, minAmount, maxAmount } = req.query as Record<string, string>
  const filtros: FiltroReporte = {
    startDate, endDate, colaborador, cliente,
    minAmount: minAmount ? parseFloat(minAmount) : undefined,
    maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
  }
  const preview = await getExportPreview(filtros)
  res.json(preview)
}

export async function handleExport(req: Request, res: Response): Promise<void> {
  const { format, startDate, endDate, colaborador, cliente, minAmount, maxAmount, fields } = req.query as Record<string, string>
  const filtros: FiltroReporte = {
    startDate, endDate, colaborador, cliente,
    minAmount: minAmount ? parseFloat(minAmount) : undefined,
    maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
    fields: fields ? fields.split(',') : undefined,
  }
  const fecha = new Date().toISOString().slice(0, 10)

  switch (format) {
    case 'csv': {
      const csv = await generarCSV(filtros)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="transacciones-${fecha}.csv"`)
      res.send(csv)
      break
    }
    case 'excel': {
      const buffer = await generarExcel(filtros)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="transacciones-${fecha}.xlsx"`)
      res.send(buffer)
      break
    }
    case 'pdf': {
      const buffer = await generarPDF(filtros)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="transacciones-${fecha}.pdf"`)
      res.send(buffer)
      break
    }
    default:
      res.status(400).json({ error: 'format debe ser csv, excel o pdf' })
  }
}
