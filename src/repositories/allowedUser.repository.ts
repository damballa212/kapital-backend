import { sql } from '../db/postgres.js'

let cache: Set<string> | null = null
let cacheExpiry = 0
const CACHE_TTL_MS = 60_000 // 1 minuto

export async function isEmailAllowed(email: string): Promise<boolean> {
  const now = Date.now()
  if (!cache || now > cacheExpiry) {
    const rows = await sql<Array<{ email: string }>>`SELECT email FROM allowed_users`
    cache = new Set(rows.map(r => r.email.toLowerCase()))
    cacheExpiry = now + CACHE_TTL_MS
  }
  return cache.has(email.toLowerCase())
}

export function invalidateAllowedUsersCache(): void {
  cache = null
  cacheExpiry = 0
}
