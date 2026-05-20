import { getAuth } from 'firebase-admin/auth'
import type { Request, Response, NextFunction } from 'express'

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido' })
    return
  }
  try {
    await getAuth().verifyIdToken(header.slice(7))
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido' })
  }
}

type Handler = (req: Request, res: Response) => Promise<void>

export function withAuth(handler: Handler): Handler {
  return async (req, res) => {
    await new Promise<void>((resolve, reject) => {
      requireAuth(req, res, () => resolve()).catch(reject)
    })
    if (res.headersSent) return
    try {
      await handler(req, res)
    } catch (err: unknown) {
      if (!res.headersSent) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        res.status(500).json({ error: msg })
      }
    }
  }
}
