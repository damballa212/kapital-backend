import { randomBytes } from 'node:crypto'

const SESSION_TTL_MS = 60_000
const sessions = new Map<string, { uid: string; expiresAt: number }>()

export function createRealtimeSessionToken(uid: string): { token: string; expiresInMs: number } {
  cleanupExpiredSessions()

  const token = randomBytes(24).toString('hex')
  sessions.set(token, {
    uid,
    expiresAt: Date.now() + SESSION_TTL_MS,
  })

  return { token, expiresInMs: SESSION_TTL_MS }
}

export function consumeRealtimeSessionToken(token: string): { uid: string } | null {
  cleanupExpiredSessions()

  const session = sessions.get(token)
  if (!session) return null

  sessions.delete(token)
  return { uid: session.uid }
}

export function resetRealtimeSessionTokens(): void {
  sessions.clear()
}

function cleanupExpiredSessions(): void {
  const now = Date.now()
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token)
    }
  }
}
