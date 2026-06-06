import type { Request, Response, NextFunction } from 'express'

export function verifyEvolutionSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET
  if (!secret) { next(); return }
  const token = req.headers['authorization'] ?? req.headers['x-webhook-token']
  if (token !== secret) {
    res.sendStatus(401)
    return
  }
  next()
}
