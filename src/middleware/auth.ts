import { getAuth } from 'firebase-admin/auth'
import type { Request, Response, NextFunction } from 'express'
import { isEmailAllowed } from '../repositories/allowedUser.repository.js'
import { logger } from '../utils/logger.js'

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido' })
    return
  }
  try {
    const verifyTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('verifyIdToken timeout')), 10_000)
    )
    const decoded = await Promise.race([getAuth().verifyIdToken(header.slice(7)), verifyTimeout])
    const email = decoded.email ?? ''
    if (!(await isEmailAllowed(email))) {
      res.status(403).json({ error: 'NOT_WHITELISTED' })
      return
    }
    res.locals ??= {}
    res.locals.auth = decoded
    next()
  } catch (err) {
    logger.error('[auth] verifyIdToken failed', { error: err instanceof Error ? err.message : String(err) })
    res.status(401).json({ error: 'Token inválido' })
  }
}

type Handler = (req: Request, res: Response) => Promise<void>

export function withAuth(handler: Handler): Handler {
  return async (req, res) => {
    await requireAuth(req, res, () => undefined)
    if (res.headersSent) return
    try {
      await handler(req, res)
    } catch (err: unknown) {
      logger.error('Authenticated handler failed', { error: err instanceof Error ? err.message : String(err) })
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error interno' })
      }
    }
  }
}
