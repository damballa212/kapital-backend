import { beforeEach, describe, expect, it, vi } from 'vitest'

let lastQuery = ''
let messageCount = '11'
const sqlMock = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
  lastQuery = strings.reduce((acc, part, index) => `${acc}${part}${index < values.length ? '$' : ''}`, '')
  return Promise.resolve([{ count: messageCount }])
})

vi.mock('../db/postgres.js', () => ({
  sql: sqlMock,
}))

const { superaRateLimit } = await import('../utils/rateLimit.js')

describe('superaRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lastQuery = ''
    messageCount = '11'
  })

  it('counts inbound WhatsApp messages instead of successful transactions', async () => {
    const limited = await superaRateLimit('595981000000@s.whatsapp.net')

    expect(limited).toBe(true)
    expect(lastQuery).toContain('whatsapp_inbound_messages')
    expect(lastQuery).not.toContain('FROM transactions')
  })

  it('allows the tenth inbound message in the active window', async () => {
    messageCount = '10'

    await expect(superaRateLimit('595981000000@s.whatsapp.net')).resolves.toBe(false)
  })
})
