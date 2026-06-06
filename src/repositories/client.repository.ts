import { sql } from '../db/postgres.js'

export async function upsertClient(name: string): Promise<void> {
  await sql`
    INSERT INTO clients (name, created_at, updated_at)
    VALUES (${name}, NOW(), NOW())
    ON CONFLICT (LOWER(name))
    DO UPDATE SET updated_at = NOW()
  `
}

export async function incrementClientCount(name: string): Promise<void> {
  await sql`
    UPDATE clients
    SET tx_count = tx_count + 1, updated_at = NOW()
    WHERE LOWER(name) = LOWER(${name})
  `
}

export async function searchClients(q: string): Promise<Array<{ name: string; txCount: number }>> {
  const rows = await sql<Array<{ name: string; tx_count: number }>>`
    SELECT name, tx_count
    FROM clients
    WHERE LOWER(name) LIKE LOWER(${'%' + q + '%'})
    ORDER BY tx_count DESC, name ASC
    LIMIT 10
  `
  return rows.map(r => ({ name: r.name, txCount: r.tx_count }))
}
