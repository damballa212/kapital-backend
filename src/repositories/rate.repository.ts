import { sql } from '../db/postgres.js'

export async function insertRate(rate: number): Promise<void> {
  await sql`
    INSERT INTO global_rate (id, rate, updated_at)
    VALUES (1, ${rate}, NOW())
    ON CONFLICT (id) DO UPDATE
      SET rate       = EXCLUDED.rate,
          updated_at = NOW()
  `
}

export async function getCurrentRate(): Promise<number | null> {
  const rows = await sql<[{ rate: string } | undefined]>`
    SELECT rate
    FROM global_rate
    ORDER BY updated_at DESC
    LIMIT 1
  `
  const row = rows[0]
  return row ? parseFloat(row.rate) : null
}
