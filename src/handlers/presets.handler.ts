import type { Request, Response } from 'express'
import { sql } from '../db/postgres.js'

export async function handleGetPresets(_req: Request, res: Response): Promise<void> {
  const rows = await sql<{ id: number; name: string; config: unknown; created_at: Date }[]>`
    SELECT id, name, config, created_at FROM export_presets ORDER BY created_at DESC
  `
  res.json(rows)
}

export async function handleSavePreset(req: Request, res: Response): Promise<void> {
  const { name, config } = req.body as { name: string; config: unknown }
  if (!name?.trim()) { res.status(400).json({ error: 'name requerido' }); return }
  if (!config)       { res.status(400).json({ error: 'config requerido' }); return }

  const rows = await sql<[{ id: number }]>`
    INSERT INTO export_presets (name, config) VALUES (${name.trim()}, ${JSON.stringify(config)})
    RETURNING id
  `
  res.status(201).json({ id: rows[0].id, name: name.trim(), config })
}

export async function handleDeletePreset(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) { res.status(400).json({ error: 'id inválido' }); return }
  await sql`DELETE FROM export_presets WHERE id = ${id}`
  res.sendStatus(204)
}
