
import type { Request, Response } from 'express'
import { getCurrentRate } from '../repositories/rate.repository.js'

export async function handleGetTasa(req: Request, res: Response): Promise<void> {
  const rate = await getCurrentRate()
  res.json({ rate })
}
