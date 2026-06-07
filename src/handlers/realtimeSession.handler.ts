import type { Request, Response } from 'express'
import { createRealtimeSessionToken } from '../services/realtime-session.service.js'

export async function handleCreateRealtimeSession(_req: Request, res: Response): Promise<void> {
  const auth = res.locals.auth as { uid?: string } | undefined
  if (!auth?.uid) {
    res.status(401).json({ error: 'Token inválido' })
    return
  }

  res.json(createRealtimeSessionToken(auth.uid))
}
