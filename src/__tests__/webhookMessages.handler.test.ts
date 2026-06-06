import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'

const findInboundMessagesMock = vi.fn()
const getInboundMessageSummaryMock = vi.fn()

vi.mock('../repositories/whatsappLog.repository.js', () => ({
  findInboundMessages: findInboundMessagesMock,
  getInboundMessageSummary: getInboundMessageSummaryMock,
  getInboundMessageDetail: vi.fn(),
}))

const { handleGetWebhookMessages } = await import('../handlers/webhookMessages.handler.js')

function makeRes(): Response {
  return {
    json: vi.fn(),
    status: vi.fn(function status(this: Response) {
      return this
    }),
  } as unknown as Response
}

describe('handleGetWebhookMessages filters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findInboundMessagesMock.mockResolvedValue({ data: [], total: 0 })
    getInboundMessageSummaryMock.mockResolvedValue({ total: 0, completed: 0, failed: 0, parseErrors: 0 })
  })

  it('accepts HOY as a parsedType filter', async () => {
    await handleGetWebhookMessages({ query: { parsedType: 'HOY' } } as unknown as Request, makeRes())

    expect(findInboundMessagesMock).toHaveBeenCalledWith(expect.objectContaining({ parsedType: 'HOY' }))
  })

  it('accepts YO as a parsedType filter', async () => {
    await handleGetWebhookMessages({ query: { parsedType: 'YO' } } as unknown as Request, makeRes())

    expect(findInboundMessagesMock).toHaveBeenCalledWith(expect.objectContaining({ parsedType: 'YO' }))
  })
})
