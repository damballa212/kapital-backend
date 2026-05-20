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
