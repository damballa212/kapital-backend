
import type { Request, Response } from 'express'
import { obtenerDashboard } from '../services/dashboard.service.js'

export async function handleGetDashboard(req: Request, res: Response): Promise<void> {
  const now = new Date()
  const year = parseInt((req.query.year as string) ?? String(now.getFullYear()), 10)
  const month = parseInt((req.query.month as string) ?? String(now.getMonth() + 1), 10)

  const data = await obtenerDashboard(year, month)
  res.json(data)
}
