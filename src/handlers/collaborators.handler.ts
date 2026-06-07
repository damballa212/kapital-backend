import type { Request, Response } from 'express'
import { z } from 'zod'
import { logger } from '../utils/logger.js'
import {
  listarColaboradores,
  crearColaborador,
  actualizarColaborador,
  eliminarColaborador,
} from '../services/collaborator.service.js'

const CreateSchema = z.object({
  name:    z.string().min(2).max(100),
  basePct: z.number().min(0).max(100).nullable().optional(),
  status:  z.enum(['active', 'inactive']).optional(),
})

const UpdateSchema = z.object({
  name:    z.string().min(2).max(100).optional(),
  basePct: z.number().min(0).max(100).nullable().optional(),
  status:  z.enum(['active', 'inactive']).optional(),
})

export async function handleGetColaboradores(_req: Request, res: Response): Promise<void> {
  const colaboradores = await listarColaboradores()
  res.json(colaboradores)
}

export async function handleCreateColaborador(req: Request, res: Response): Promise<void> {
  const parsed = CreateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const { name, basePct = null, status = 'active' } = parsed.data
  try {
    const colaborador = await crearColaborador(name, basePct ?? null, status)
    res.status(201).json(colaborador)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error creando colaborador'
    // Unique constraint violation
    if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('collaborators_name_lower_idx')) {
      res.status(409).json({ error: 'Ya existe un colaborador con ese nombre' })
    } else {
      logger.error('Error creando colaborador', { error: err instanceof Error ? err.message : String(err) })
      res.status(500).json({ error: 'Error creando colaborador' })
    }
  }
}

export async function handleUpdateColaborador(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'ID inválido' })
    return
  }
  const parsed = UpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const colaborador = await actualizarColaborador(id, parsed.data)
    res.json(colaborador)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error actualizando colaborador'
    if (msg.includes('no encontrado')) {
      res.status(404).json({ error: msg })
    } else {
      logger.error('Error actualizando colaborador', { error: err instanceof Error ? err.message : String(err) })
      res.status(500).json({ error: 'Error actualizando colaborador' })
    }
  }
}

export async function handleDeleteColaborador(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'ID inválido' })
    return
  }
  try {
    await eliminarColaborador(id)
    res.sendStatus(204)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error eliminando colaborador'
    if (msg.includes('no encontrado')) {
      res.status(404).json({ error: msg })
    } else {
      logger.error('Error eliminando colaborador', { error: err instanceof Error ? err.message : String(err) })
      res.status(500).json({ error: 'Error eliminando colaborador' })
    }
  }
}
