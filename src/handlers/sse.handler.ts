import type { Request, Response } from 'express'
import { eventBus, type AppEvent } from '../services/eventBus.js'
import { consumeRealtimeSessionToken } from '../services/realtime-session.service.js'

export async function handleSSE(req: Request, res: Response): Promise<void> {
  const token = req.query.token as string
  if (!token) { res.sendStatus(401); return }

  if (!consumeRealtimeSessionToken(token)) {
    res.sendStatus(401)
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const send = (event: AppEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000)

  eventBus.on('event', send)

  req.on('close', () => {
    clearInterval(heartbeat)
    eventBus.off('event', send)
  })
}
