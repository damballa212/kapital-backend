import { getAuth } from 'firebase-admin/auth'
import type { Request, Response, NextFunction } from 'express'

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido' })
    return
  }
  try {
    res.locals ??= {}
    res.locals.auth = await getAuth().verifyIdToken(header.slice(7))
    next()
  } catch {
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
      console.error('Authenticated handler failed', err)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error interno' })
      }
    }
  }
}
