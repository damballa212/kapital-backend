import http from 'node:http'
import { Socket } from 'node:net'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type express from 'express'

const createInboundMessageLogMock = vi.fn()
const recordWebhookFlowEventMock = vi.fn()
const updateInboundMessageLogMock = vi.fn()
const enviarConfirmacionTransaccionMock = vi.fn()
const getTasaVigenteMock = vi.fn()
const procesarTransaccionMock = vi.fn()

vi.mock('../repositories/whatsappLog.repository.js', () => ({
  createInboundMessageLog: createInboundMessageLogMock,
  recordWebhookFlowEvent: recordWebhookFlowEventMock,
  updateInboundMessageLog: updateInboundMessageLogMock,
  findInboundMessages: vi.fn(),
  getInboundMessageSummary: vi.fn(),
  getInboundMessageDetail: vi.fn(),
}))

vi.mock('../services/whatsapp.service.js', () => ({
  enviarConfirmacionTransaccion: enviarConfirmacionTransaccionMock,
  enviarConfirmacionTasa: vi.fn(),
  enviarError: vi.fn(),
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

const { createApp } = await import('../app.js')

function evolutionPayload(content: string) {
  return {
    data: {
      key: { remoteJid: '595981000000@s.whatsapp.net', id: 'MSG-INTEGRATION-1' },
      message: { conversation: content },
      messageTimestamp: 1710000000,
      pushName: 'Operador Test',
    },
  }
}

describe('WhatsApp webhook HTTP integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createInboundMessageLogMock.mockResolvedValue(7)
    recordWebhookFlowEventMock.mockResolvedValue(undefined)
    updateInboundMessageLogMock.mockResolvedValue(undefined)
    getTasaVigenteMock.mockResolvedValue(7300)
    procesarTransaccionMock.mockResolvedValue({ transactionId: 55 })
    enviarConfirmacionTransaccionMock.mockResolvedValue(undefined)

  })

  it('accepts an Evolution payload, processes a transaction, and records trace stages', async () => {
    const res = await invokeApp(createApp(), 'POST', '/webhook/whatsapp', evolutionPayload('#TRANSACCION Cliente Ana: 500$ - 15%'))
    await waitFor(() => procesarTransaccionMock.mock.calls.length > 0)

    expect(res.status).toBe(200)
    expect(createInboundMessageLogMock).toHaveBeenCalledWith(expect.objectContaining({
      messageId: 'MSG-INTEGRATION-1',
      chatId: '595981000000@s.whatsapp.net',
      userName: 'Operador Test',
    }), expect.any(Object))
    expect(procesarTransaccionMock).toHaveBeenCalled()
    expect(enviarConfirmacionTransaccionMock).toHaveBeenCalled()
    expect(recordWebhookFlowEventMock).toHaveBeenCalledWith(7, expect.objectContaining({
      stage: 'transaction_created',
      status: 'ok',
    }))
    expect(updateInboundMessageLogMock).toHaveBeenCalledWith(7, expect.objectContaining({
      status: 'confirmation_sent',
      transactionId: 55,
      finish: true,
    }))
  })
})

async function invokeApp(
  app: express.Express,
  method: string,
  url: string,
  body?: unknown
): Promise<{ status: number; body: string }> {
  const socket = new Socket()
  const req = new http.IncomingMessage(socket)
  const res = new http.ServerResponse(req)
  const chunks: Buffer[] = []
  const rawBody = body === undefined ? '' : JSON.stringify(body)

  req.method = method
  req.url = url
  req.headers = {
    host: 'test.local',
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(rawBody).toString(),
  }

  res.assignSocket(socket)
  const originalWrite = res.write.bind(res)
  const originalEnd = res.end.bind(res)

  res.write = ((chunk: unknown, ...args: unknown[]) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
    return originalWrite(chunk as never, ...args as never)
  }) as typeof res.write

  res.end = ((chunk?: unknown, ...args: unknown[]) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
    return originalEnd(chunk as never, ...args as never)
  }) as typeof res.end

  const done = new Promise<{ status: number; body: string }>((resolve, reject) => {
    res.on('finish', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }))
    res.on('error', reject)
  })

  app.handle(req, res)
  req.push(rawBody)
  req.push(null)

  return done
}

async function waitFor(assertion: () => boolean, timeoutMs = 250): Promise<void> {
  const started = Date.now()
  while (!assertion()) {
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for async webhook processing')
    await new Promise(resolve => setTimeout(resolve, 5))
  }
}
