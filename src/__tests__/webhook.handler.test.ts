import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'

const createInboundMessageLogMock = vi.fn()
const recordWebhookFlowEventMock = vi.fn()
const updateInboundMessageLogMock = vi.fn()
const enviarConfirmacionTransaccionMock = vi.fn()
const enviarErrorMock = vi.fn()
const getTasaVigenteMock = vi.fn()
const procesarTransaccionMock = vi.fn()

vi.mock('../repositories/whatsappLog.repository.js', () => ({
  createInboundMessageLog: createInboundMessageLogMock,
  recordWebhookFlowEvent: recordWebhookFlowEventMock,
  updateInboundMessageLog: updateInboundMessageLogMock,
}))

vi.mock('../services/whatsapp.service.js', () => ({
  enviarConfirmacionTransaccion: enviarConfirmacionTransaccionMock,
  enviarConfirmacionTasa: vi.fn(),
  enviarError: enviarErrorMock,
}))

vi.mock('../services/rate.service.js', () => ({
  getTasaVigente: getTasaVigenteMock,
  setTasa: vi.fn(),
}))

vi.mock('../services/transaction.service.js', () => ({
  procesarTransaccion: procesarTransaccionMock,
}))

vi.mock('../utils/rateLimit.js', () => ({
  superaRateLimit: vi.fn().mockResolvedValue(false),
}))

const { handleWhatsAppWebhook } = await import('../handlers/webhook.handler.js')

function makeReq(content: string): Request {
  return {
    body: {
      data: {
        key: { remoteJid: '595981000000@s.whatsapp.net', id: 'MSG-1' },
        message: { conversation: content },
        messageTimestamp: 1710000000,
        pushName: 'Operador',
      },
    },
  } as Request
}

function makeRes(): Response {
  return {
    sendStatus: vi.fn(),
  } as unknown as Response
}

describe('handleWhatsAppWebhook tracing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createInboundMessageLogMock.mockResolvedValue(100)
    recordWebhookFlowEventMock.mockResolvedValue(undefined)
    updateInboundMessageLogMock.mockResolvedValue(undefined)
    enviarConfirmacionTransaccionMock.mockResolvedValue(undefined)
    enviarErrorMock.mockResolvedValue(undefined)
    getTasaVigenteMock.mockResolvedValue(7300)
    procesarTransaccionMock.mockResolvedValue({ transactionId: 42 })
  })

  it('logs parse errors so the bot monitor can show failed inbound messages', async () => {
    const res = makeRes()

    await handleWhatsAppWebhook(makeReq('mensaje sin formato'), res)

    expect(res.sendStatus).toHaveBeenCalledWith(200)
    expect(createInboundMessageLogMock).toHaveBeenCalledWith(expect.objectContaining({
      chatId: '595981000000@s.whatsapp.net',
      messageId: 'MSG-1',
      content: 'mensaje sin formato',
    }), expect.any(Object))
    expect(recordWebhookFlowEventMock).toHaveBeenCalledWith(100, expect.objectContaining({
      stage: 'parse_error',
      status: 'failed',
    }))
    expect(updateInboundMessageLogMock).toHaveBeenCalledWith(100, expect.objectContaining({
      status: 'parse_error',
      flowStage: 'parse_error',
      parsedType: 'ERROR',
    }))
    expect(enviarErrorMock).toHaveBeenCalledWith(
      '595981000000@s.whatsapp.net',
      expect.any(String)
    )
  })

  it('keeps transaction id visible when WhatsApp confirmation fails after insert', async () => {
    enviarConfirmacionTransaccionMock.mockRejectedValue(new Error('Evolution timeout'))

    await handleWhatsAppWebhook(
      makeReq('#TRANSACCION Cliente Ana: 500$ - 15%'),
      makeRes()
    )

    expect(procesarTransaccionMock).toHaveBeenCalled()
    expect(recordWebhookFlowEventMock).toHaveBeenCalledWith(100, expect.objectContaining({
      stage: 'transaction_created',
      status: 'ok',
    }))
    expect(recordWebhookFlowEventMock).toHaveBeenCalledWith(100, expect.objectContaining({
      stage: 'confirmation_failed',
      status: 'failed',
    }))
    expect(updateInboundMessageLogMock).toHaveBeenCalledWith(100, expect.objectContaining({
      status: 'confirmation_failed',
      flowStage: 'confirmation_failed',
      parsedType: 'TRANSACCION',
      transactionId: 42,
      errorMessage: 'Evolution timeout',
    }))
  })
})
