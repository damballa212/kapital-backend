
import type { Request, Response } from 'express'
import { getCurrentRate } from '../repositories/rate.repository.js'
import { listarColaboradores } from '../services/collaborator.service.js'

export async function handleGetTasa(req: Request, res: Response): Promise<void> {
  const rate = await getCurrentRate()
  res.json({ rate })
}

export async function handleGetColaboradores(req: Request, res: Response): Promise<void> {
  const colaboradores = await listarColaboradores()
  res.json(colaboradores)
}
