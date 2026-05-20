
import type { Request, Response } from 'express'
import { parsearMensaje } from '../services/parser.service.js'
import { procesarTransaccion } from '../services/transaction.service.js'
import { setTasa, getTasaVigente } from '../services/rate.service.js'
import { enviarConfirmacionTransaccion, enviarConfirmacionTasa, enviarError } from '../services/whatsapp.service.js'
import { superaRateLimit } from '../utils/rateLimit.js'
import type { WhatsAppPayload } from '../domain/webhook.js'

function extraerPayload(body: Record<string, unknown>): WhatsAppPayload | null {
  try {
    const data = body?.data as Record<string, unknown>
    const key = data?.key as Record<string, unknown>
    const message = data?.message as Record<string, unknown>
    const content = (message?.conversation as string) ?? (message?.extendedTextMessage as Record<string, unknown>)?.text as string
    const chatId = key?.remoteJid as string
    const messageId = key?.id as string
    const timestamp = String((data?.messageTimestamp as number) ?? Date.now())
    const userName = (data?.pushName as string) ?? ''

    if (!chatId || !content || !messageId) return null
    return { chatId, content, messageId, timestamp, userName }
  } catch {
    return null
  }
}

export async function handleWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  // Evolution API espera 200 siempre para no reintentar
  res.sendStatus(200)

  const payload = extraerPayload(req.body as Record<string, unknown>)
  if (!payload) return

  // Ignorar mensajes propios o de grupos
  if (payload.chatId.endsWith('@g.us')) return

  try {
    if (await superaRateLimit(payload.chatId)) {
      await enviarError(payload.chatId, 'Límite de mensajes alcanzado. Espera 1 minuto.')
      return
    }

    const parsed = parsearMensaje(payload.content)

    if (parsed.type === 'ERROR') {
      await enviarError(payload.chatId, parsed.mensaje)
      return
    }

    if (parsed.type === 'TASA') {
      const tasa = await setTasa(parsed.tasa)
      await enviarConfirmacionTasa(payload.chatId, tasa)
      return
    }

    if (parsed.type === 'TRANSACCION') {
      const tasa = await getTasaVigente()
      const comisiones = await procesarTransaccion(parsed, payload, tasa)
      await enviarConfirmacionTransaccion(payload.chatId, comisiones)
    }
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Error interno'
    await enviarError(payload.chatId, mensaje).catch(() => undefined)
  }
}
