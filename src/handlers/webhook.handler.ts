
import type { Request, Response } from 'express'
import { parsearMensaje } from '../services/parser.service.js'
import { procesarTransaccion, DuplicateTransactionError } from '../services/transaction.service.js'
import { setTasa, getTasaVigente } from '../services/rate.service.js'
import {
  enviarConfirmacionTransaccion,
  enviarConfirmacionTasa,
  enviarResumenHoy,
  enviarResumenYo,
  enviarError,
} from '../services/whatsapp.service.js'
import { superaRateLimit } from '../utils/rateLimit.js'
import { normalizeWhatsAppPayload } from '../services/webhook-normalizer.service.js'
import { getCurrentRate } from '../repositories/rate.repository.js'
import { getResumenHoy, getResumenColaboradorMes } from '../repositories/transaction.repository.js'
import { findCollaboratorByName } from '../repositories/collaborator.repository.js'
import { resolverColaborador } from '../services/transaction.service.js'
import {
  createInboundMessageLog,
  recordWebhookFlowEvent,
  updateInboundMessageLog,
} from '../repositories/whatsappLog.repository.js'
import type { WhatsappInboundStatus } from '../domain/whatsappLog.js'

export async function handleWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  // Evolution API espera 200 siempre para no reintentar
  res.sendStatus(200)

  const payload = normalizeWhatsAppPayload(req.body as Record<string, unknown>)
  if (!payload) return
  const messageLogId = await createInboundMessageLog(payload, req.body as Record<string, unknown>)
  await recordWebhookFlowEvent(messageLogId, {
    stage: 'received',
    status: 'ok',
    details: {
      chatId: payload.chatId,
      rawChatId: payload.rawChatId,
      alternateChatIds: payload.alternateChatIds,
      messageId: payload.messageId,
      sourceShape: payload.sourceShape,
      messageType: payload.messageType,
    },
  })

  // Ignorar mensajes propios o de grupos
  if (payload.chatId.endsWith('@g.us')) {
    await recordWebhookFlowEvent(messageLogId, {
      stage: 'ignored_group',
      status: 'skipped',
      details: { chatId: payload.chatId },
    })
    await updateInboundMessageLog(messageLogId, {
      status: 'ignored_group',
      flowStage: 'ignored_group',
      finish: true,
    })
    return
  }

  try {
    if (await superaRateLimit(payload.chatId)) {
      await enviarError(payload.chatId, 'Límite de mensajes alcanzado. Espera 1 minuto.')
      await recordWebhookFlowEvent(messageLogId, {
        stage: 'rate_limited',
        status: 'failed',
        details: { chatId: payload.chatId },
      })
      await updateInboundMessageLog(messageLogId, {
        status: 'rate_limited',
        flowStage: 'rate_limited',
        errorMessage: 'Límite de mensajes alcanzado. Espera 1 minuto.',
        finish: true,
      })
      return
    }

    const parsed = parsearMensaje(payload.content)
    await recordWebhookFlowEvent(messageLogId, {
      stage: 'parsed',
      status: parsed.type === 'ERROR' ? 'failed' : 'ok',
      details: { type: parsed.type },
    })

    if (parsed.type === 'ERROR') {
      await enviarError(payload.chatId, parsed.mensaje)
      await recordWebhookFlowEvent(messageLogId, {
        stage: 'parse_error',
        status: 'failed',
        details: { mensaje: parsed.mensaje },
      })
      await updateInboundMessageLog(messageLogId, {
        status: 'parse_error',
        flowStage: 'parse_error',
        parsedType: 'ERROR',
        errorMessage: parsed.mensaje,
        finish: true,
      })
      return
    }

    if (parsed.type === 'TASA') {
      const tasa = await setTasa(parsed.tasa)
      await enviarConfirmacionTasa(payload.chatId, tasa)
      await recordWebhookFlowEvent(messageLogId, {
        stage: 'rate_updated',
        status: 'ok',
        details: { tasa },
      })
      await updateInboundMessageLog(messageLogId, {
        status: 'rate_updated',
        flowStage: 'rate_updated',
        parsedType: 'TASA',
        finish: true,
      })
      return
    }

    if (parsed.type === 'HOY') {
      const tasaActual = await getCurrentRate()
      const resumen = await getResumenHoy(tasaActual)
      await enviarResumenHoy(payload.chatId, resumen)
      await recordWebhookFlowEvent(messageLogId, { stage: 'hoy_sent', status: 'ok', details: { totalTransacciones: resumen.totalTransacciones } })
      await updateInboundMessageLog(messageLogId, { status: 'confirmation_sent', flowStage: 'hoy_sent', parsedType: 'HOY', finish: true })
      return
    }

    if (parsed.type === 'YO') {
      const now = new Date()
      const year  = now.getFullYear()
      const month = now.getMonth() + 1

      // Identificar al colaborador por userName (pushName de WhatsApp)
      const userName = payload.userName || ''
      const dbColab = await findCollaboratorByName(userName)
      let nombre: string
      let esGabriel: boolean

      if (dbColab) {
        nombre    = dbColab.name
        esGabriel = dbColab.basePctUsdTotal === 0
      } else {
        // Fallback al resolver hardcodeado
        try {
          const resolved = resolverColaborador(userName || null, 13, null)
          nombre    = resolved.colaborador
          esGabriel = resolved.pct === 0
        } catch {
          await enviarError(payload.chatId, 'No te reconozco como colaborador. Asegurate de que tu nombre en WhatsApp coincida con el registrado.')
          await updateInboundMessageLog(messageLogId, { status: 'parse_error', flowStage: 'yo_not_found', parsedType: 'YO', errorMessage: 'colaborador no identificado', finish: true })
          return
        }
      }

      const resumen = await getResumenColaboradorMes(nombre, esGabriel, year, month)
      await enviarResumenYo(payload.chatId, resumen)
      await recordWebhookFlowEvent(messageLogId, { stage: 'yo_sent', status: 'ok', details: { nombre } })
      await updateInboundMessageLog(messageLogId, { status: 'confirmation_sent', flowStage: 'yo_sent', parsedType: 'YO', finish: true })
      return
    }

    if (parsed.type === 'TRANSACCION') {
      const tasa = await getTasaVigente()
      const comisiones = await procesarTransaccion(parsed, payload, tasa)
      await recordWebhookFlowEvent(messageLogId, {
        stage: 'transaction_created',
        status: 'ok',
        details: { transactionId: comisiones.transactionId },
      })
      await updateInboundMessageLog(messageLogId, {
        status: 'transaction_created',
        flowStage: 'transaction_created',
        parsedType: 'TRANSACCION',
        transactionId: comisiones.transactionId,
      })
      try {
        await enviarConfirmacionTransaccion(payload.chatId, comisiones)
      } catch (err) {
        const mensaje = err instanceof Error ? err.message : 'Error enviando confirmación'
        await recordWebhookFlowEvent(messageLogId, {
          stage: 'confirmation_failed',
          status: 'failed',
          details: { transactionId: comisiones.transactionId, mensaje },
        }).catch(() => undefined)
        await updateInboundMessageLog(messageLogId, {
          status: 'confirmation_failed',
          flowStage: 'confirmation_failed',
          parsedType: 'TRANSACCION',
          transactionId: comisiones.transactionId,
          errorMessage: mensaje,
          finish: true,
        }).catch(() => undefined)
        return
      }
      await recordWebhookFlowEvent(messageLogId, {
        stage: 'confirmation_sent',
        status: 'ok',
        details: { transactionId: comisiones.transactionId },
      })
      await updateInboundMessageLog(messageLogId, {
        status: 'confirmation_sent',
        flowStage: 'confirmation_sent',
        parsedType: 'TRANSACCION',
        transactionId: comisiones.transactionId,
        finish: true,
      })
    }
  } catch (err) {
    if (err instanceof DuplicateTransactionError) {
      await recordWebhookFlowEvent(messageLogId, {
        stage: 'ignored_duplicate',
        status: 'skipped',
        details: { idempotencyKey: err.idempotencyKey },
      }).catch(() => undefined)
      await updateInboundMessageLog(messageLogId, {
        status: 'ignored_group',
        flowStage: 'ignored_duplicate',
        finish: true,
      }).catch(() => undefined)
      return
    }
    const mensaje = err instanceof Error ? err.message : 'Error interno'
    await enviarError(payload.chatId, mensaje).catch(() => undefined)
    const status: WhatsappInboundStatus = mensaje.toLowerCase().includes('confirm')
      ? 'confirmation_failed'
      : 'failed'
    await recordWebhookFlowEvent(messageLogId, {
      stage: status,
      status: 'failed',
      details: { mensaje },
    }).catch(() => undefined)
    await updateInboundMessageLog(messageLogId, {
      status,
      flowStage: status,
      errorMessage: mensaje,
      finish: true,
    }).catch(() => undefined)
  }
}
