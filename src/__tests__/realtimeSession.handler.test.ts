import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'

const createRealtimeSessionTokenMock = vi.fn()

vi.mock('../services/realtime-session.service.js', () => ({
  createRealtimeSessionToken: createRealtimeSessionTokenMock,
}))

const { handleCreateRealtimeSession } = await import('../handlers/realtimeSession.handler.js')

describe('handleCreateRealtimeSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createRealtimeSessionTokenMock.mockReturnValue({
      token: 'ephemeral-token',
      expiresInMs: 60_000,
    })
  })

  it('returns an ephemeral token for an authenticated user', async () => {
    const res = mockResponse({ auth: { uid: 'user-123' } })

    await handleCreateRealtimeSession({} as Request, res)

    expect(createRealtimeSessionTokenMock).toHaveBeenCalledWith('user-123')
    expect(res.json).toHaveBeenCalledWith({
      token: 'ephemeral-token',
      expiresInMs: 60_000,
    })
  })
})

function mockResponse(locals: Record<string, unknown> = {}): Response {
  return {
    locals,
    status: vi.fn(function status(this: Response) {
      return this
    }),
    json: vi.fn(function json(this: Response) {
      return this
    }),
  } as unknown as Response
}
