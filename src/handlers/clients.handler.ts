import type { Request, Response } from 'express'
import { searchClients } from '../repositories/client.repository.js'

export async function handleSearchClients(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? '').trim()
  if (!q) { res.json([]); return }
  const clients = await searchClients(q)
  res.json(clients)
}
