import { sql } from '../db/postgres.js'

const LIMIT = 10
const VENTANA_MS = 60 * 1000

export async function superaRateLimit(chatId: string): Promise<boolean> {
  const desde = new Date(Date.now() - VENTANA_MS).toISOString()
  const rows = await sql<[{ count: string }]>`
    SELECT COUNT(*)::text AS count
    FROM transactions
    WHERE chat_id = ${chatId}
      AND created_at > ${desde}
  `
  return parseInt(rows[0].count, 10) >= LIMIT
}
