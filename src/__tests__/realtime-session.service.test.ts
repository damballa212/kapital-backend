import { beforeEach, describe, expect, it } from 'vitest'

const {
  createRealtimeSessionToken,
  consumeRealtimeSessionToken,
  resetRealtimeSessionTokens,
} = await import('../services/realtime-session.service.js')

describe('realtime session token store', () => {
  beforeEach(() => {
    resetRealtimeSessionTokens()
  })

  it('creates a token that can be consumed exactly once', () => {
    const { token } = createRealtimeSessionToken('user-1')

    expect(consumeRealtimeSessionToken(token)).toEqual({ uid: 'user-1' })
    expect(consumeRealtimeSessionToken(token)).toBeNull()
  })
})
