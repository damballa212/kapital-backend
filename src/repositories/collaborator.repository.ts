import { sql } from '../db/postgres.js'
import type { Collaborator } from '../domain/collaborator.js'

export async function upsertCollaborator(name: string, basePct: number | null): Promise<void> {
  await sql`
    INSERT INTO collaborators (name, base_pct_usd_total, created_at, updated_at)
    VALUES (${name}, ${basePct}, NOW(), NOW())
    ON CONFLICT (LOWER(name))
    DO UPDATE SET
      base_pct_usd_total = COALESCE(EXCLUDED.base_pct_usd_total, collaborators.base_pct_usd_total),
      updated_at = NOW()
  `
}

export async function incrementCollaboratorCount(name: string): Promise<void> {
  await sql`
    UPDATE collaborators
    SET tx_count = tx_count + 1, updated_at = NOW()
    WHERE LOWER(name) = LOWER(${name})
  `
}

export async function findAllCollaborators(): Promise<Collaborator[]> {
  const rows = await sql<Array<{
    id: number
    name: string
    base_pct_usd_total: string | null
    tx_count: number
    created_at: Date
    updated_at: Date
  }>>`
    SELECT id, name, base_pct_usd_total, tx_count, created_at, updated_at
    FROM collaborators
    ORDER BY name ASC
  `
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    basePctUsdTotal: r.base_pct_usd_total ? parseFloat(r.base_pct_usd_total) : null,
    txCount: r.tx_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}
