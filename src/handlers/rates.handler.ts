
import type { Request, Response } from 'express'
import { getTasaVigente } from '../services/rate.service.js'
import { listarColaboradores } from '../services/collaborator.service.js'

export async function handleGetTasa(req: Request, res: Response): Promise<void> {
  const tasa = await getTasaVigente()
  res.json({ rate: tasa })
}

export async function handleGetColaboradores(req: Request, res: Response): Promise<void> {
  const colaboradores = await listarColaboradores()
  res.json(colaboradores)
}
