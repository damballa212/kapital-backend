
import type { Request, Response } from 'express'
import { parsearMensaje, AYUDA_MSG } from '../services/parser.service.js'
import { procesarTransaccion, DuplicateTransactionError } from '../services/transaction.service.js'
import { setTasa, getTasaVigente } from '../services/rate.service.js'
import {
  enviarConfirmacionTransaccion,
  enviarConfirmacionTasa,
  enviarResumenHoy,
  enviarResumenYo,
  enviarAyuda,
  enviarError,
  buildTextoConfirmacionTransaccion,
  buildTextoConfirmacionTasa,
  buildTextoResumenHoy,
  buildTextoResumenYo,
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
  const payload = normalizeWhatsAppPayload(req.body as Record<string, unknown>)
  if (!payload) {
    res.sendStatus(200)
    return
  }

  // Proceso completo antes de responder: Azure Functions termina la invocación
  // al resolver el Promise (cuando res.end() es llamado). Si respondemos primero,
  // todo el trabajo asíncrono posterior queda abandonado.
  let messageLogId = -1
  try {
    messageLogId = await createInboundMessageLog(payload, req.body as Record<string, unknown>)
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
      res.sendStatus(200)
      return
    }

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
      res.sendStatus(200)
      return
    }

    const parsed = parsearMensaje(payload.content)
    await recordWebhookFlowEvent(messageLogId, {
      stage: 'parsed',
      status: parsed.type === 'ERROR' ? 'failed' : 'ok',
      details: { type: parsed.type },
    })

    if (parsed.type === 'AYUDA') {
      await updateInboundMessageLog(messageLogId, { responseText: AYUDA_MSG })
      await enviarAyuda(payload.chatId, AYUDA_MSG)
      await recordWebhookFlowEvent(messageLogId, { stage: 'hoy_sent', status: 'ok', details: {} })
      await updateInboundMessageLog(messageLogId, {
        status: 'confirmation_sent',
        flowStage: 'confirmation_sent',
        parsedType: 'ERROR',
        finish: true,
      })
      res.sendStatus(200)
      return
    }

    if (parsed.type === 'ERROR') {
      const responseText = `❌ ${parsed.mensaje}`
      await updateInboundMessageLog(messageLogId, { responseText })
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
      res.sendStatus(200)
      return
    }

    if (parsed.type === 'TASA') {
      const tasa = await setTasa(parsed.tasa)
      const responseText = buildTextoConfirmacionTasa(tasa)
      await updateInboundMessageLog(messageLogId, { responseText })
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
      res.sendStatus(200)
      return
    }

    if (parsed.type === 'HOY') {
      const tasaActual = await getCurrentRate()
      const resumen = await getResumenHoy(tasaActual)
      const responseText = buildTextoResumenHoy(resumen)
      await updateInboundMessageLog(messageLogId, { responseText })
      await enviarResumenHoy(payload.chatId, resumen)
      await recordWebhookFlowEvent(messageLogId, { stage: 'hoy_sent', status: 'ok', details: { totalTransacciones: resumen.totalTransacciones } })
      await updateInboundMessageLog(messageLogId, { status: 'confirmation_sent', flowStage: 'hoy_sent', parsedType: 'HOY', finish: true })
      res.sendStatus(200)
      return
    }

    if (parsed.type === 'YO') {
      const now = new Date()
      const year  = now.getFullYear()
      const month = now.getMonth() + 1

      const userName = payload.userName || ''
      const dbColab = await findCollaboratorByName(userName)
      let nombre: string
      let esGabriel: boolean

      if (dbColab) {
        nombre    = dbColab.name
        esGabriel = dbColab.basePctUsdTotal === 0
      } else {
        try {
          const resolved = resolverColaborador(userName || null, 13, null)
          nombre    = resolved.colaborador
          esGabriel = resolved.pct === 0
        } catch {
          const errMsg = 'No te reconozco como colaborador. Asegurate de que tu nombre en WhatsApp coincida con el registrado.'
          await updateInboundMessageLog(messageLogId, { responseText: `❌ ${errMsg}` })
          await enviarError(payload.chatId, errMsg)
          await updateInboundMessageLog(messageLogId, { status: 'parse_error', flowStage: 'yo_not_found', parsedType: 'YO', errorMessage: errMsg, finish: true })
          res.sendStatus(200)
          return
        }
      }

      const resumen = await getResumenColaboradorMes(nombre, esGabriel, year, month)
      const responseText = buildTextoResumenYo(resumen)
      await updateInboundMessageLog(messageLogId, { responseText })
      await enviarResumenYo(payload.chatId, resumen)
      await recordWebhookFlowEvent(messageLogId, { stage: 'yo_sent', status: 'ok', details: { nombre } })
      await updateInboundMessageLog(messageLogId, { status: 'confirmation_sent', flowStage: 'yo_sent', parsedType: 'YO', finish: true })
      res.sendStatus(200)
      return
    }

    if (parsed.type === 'TRANSACCION') {
      const tasa = await getTasaVigente()
      const comisiones = await procesarTransaccion(parsed, payload, tasa)
      const responseText = buildTextoConfirmacionTransaccion(comisiones)
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
        responseText,
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
        res.sendStatus(200)
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

    res.sendStatus(200)
  } catch (err) {
    if (err instanceof DuplicateTransactionError) {
      if (messageLogId !== -1) {
        await recordWebhookFlowEvent(messageLogId, {
          stage: 'ignored_duplicate',
          status: 'skipped',
          details: { idempotencyKey: err.idempotencyKey },
        }).catch(() => undefined)
        await updateInboundMessageLog(messageLogId, {
          status: 'ignored_duplicate',
          flowStage: 'ignored_duplicate',
          finish: true,
        }).catch(() => undefined)
      }
      res.sendStatus(200)
      return
    }
    const mensajeInterno = err instanceof Error ? err.message : 'Error interno'
    await enviarError(payload.chatId, 'Ocurrió un error interno. Por favor reintentá en unos segundos.').catch(() => undefined)
    if (messageLogId !== -1) {
      const status: WhatsappInboundStatus = mensajeInterno.toLowerCase().includes('confirm')
        ? 'confirmation_failed'
        : 'failed'
      await recordWebhookFlowEvent(messageLogId, {
        stage: status,
        status: 'failed',
        details: { mensaje: mensajeInterno },
      }).catch(() => undefined)
      await updateInboundMessageLog(messageLogId, {
        status,
        flowStage: status,
        errorMessage: mensajeInterno,
        finish: true,
      }).catch(() => undefined)
    }
    res.sendStatus(200)
  }
}
