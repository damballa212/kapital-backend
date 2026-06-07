
import type { Request, Response } from 'express'
import { findTransactions, deleteTransaction } from '../repositories/transaction.repository.js'
import type { FiltroTransacciones } from '../domain/transaction.js'
export async function handleGetTransacciones(req: Request, res: Response): Promise<void> {
  const { startDate, endDate, colaborador, cliente } = req.query as Record<string, string>
  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? '50', 10)))

  const filtros: FiltroTransacciones = { startDate, endDate, colaborador, cliente, page, limit }

  const result = await findTransactions(filtros)
  res.json({
    data: result.data,
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    },
  })
}

export async function handleDeleteTransaccion(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) { res.status(400).json({ error: 'id inválido' }); return }
  const deleted = await deleteTransaction(id)
  if (!deleted) { res.status(404).json({ error: 'Transacción no encontrada' }); return }
  res.sendStatus(204)
}
