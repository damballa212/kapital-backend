import { sql } from '../db/postgres.js'
import type { Collaborator } from '../domain/collaborator.js'

type CollaboratorRow = {
  id: number
  name: string
  base_pct_usd_total: string | null
  tx_count: number
  status: string
  created_at: Date
  updated_at: Date
}

function mapRow(r: CollaboratorRow): Collaborator {
  return {
    id: r.id,
    name: r.name,
    basePctUsdTotal: r.base_pct_usd_total ? parseFloat(r.base_pct_usd_total) : null,
    txCount: r.tx_count,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

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
  const rows = await sql<CollaboratorRow[]>`
    SELECT id, name, base_pct_usd_total, tx_count, status, created_at, updated_at
    FROM collaborators
    ORDER BY name ASC
  `
  return rows.map(mapRow)
}

export async function findCollaboratorByName(name: string): Promise<Collaborator | null> {
  const rows = await sql<CollaboratorRow[]>`
    SELECT id, name, base_pct_usd_total, tx_count, status, created_at, updated_at
    FROM collaborators
    WHERE LOWER(name) = LOWER(${name})
      AND status = 'active'
    LIMIT 1
  `
  return rows.length ? mapRow(rows[0]) : null
}

export async function createCollaborator(
  name: string,
  basePct: number | null,
  status: string = 'active'
): Promise<Collaborator> {
  const rows = await sql<CollaboratorRow[]>`
    INSERT INTO collaborators (name, base_pct_usd_total, tx_count, status, created_at, updated_at)
    VALUES (${name}, ${basePct}, 0, ${status}, NOW(), NOW())
    RETURNING id, name, base_pct_usd_total, tx_count, status, created_at, updated_at
  `
  return mapRow(rows[0])
}

export async function updateCollaboratorById(
  id: number,
  fields: { name?: string; basePct?: number | null; status?: string }
): Promise<Collaborator | null> {
  const rows = await sql<CollaboratorRow[]>`
    UPDATE collaborators
    SET
      name              = COALESCE(${fields.name ?? null}, name),
      base_pct_usd_total = ${fields.basePct !== undefined ? fields.basePct : sql`base_pct_usd_total`},
      status            = COALESCE(${fields.status ?? null}, status),
      updated_at        = NOW()
    WHERE id = ${id}
    RETURNING id, name, base_pct_usd_total, tx_count, status, created_at, updated_at
  `
  return rows.length ? mapRow(rows[0]) : null
}

export async function deleteCollaboratorById(id: number): Promise<boolean> {
  const result = await sql`
    DELETE FROM collaborators WHERE id = ${id}
  `
  return (result as unknown as { count: number }).count > 0
}
