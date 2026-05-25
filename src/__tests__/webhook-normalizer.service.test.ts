import { describe, expect, it } from 'vitest'
import { normalizeWhatsAppPayload } from '../services/webhook-normalizer.service.js'
import { generarIdempotencyKey } from '../utils/idempotency.js'

describe('normalizeWhatsAppPayload', () => {
  it('normaliza payload directo de Evolution', () => {
    const payload = normalizeWhatsAppPayload({
      data: {
        key: { remoteJid: '595981000000@s.whatsapp.net', id: 'MSG-1' },
        message: { conversation: '#TASA 7300' },
        messageTimestamp: 1710000000,
        pushName: 'Operador',
      },
    })

    expect(payload).toMatchObject({
      chatId: '595981000000@s.whatsapp.net',
      rawChatId: '595981000000@s.whatsapp.net',
      alternateChatIds: [],
      messageId: 'MSG-1',
      content: '#TASA 7300',
      sourceShape: 'direct-evolution',
      messageType: 'conversation',
      userName: 'Operador',
    })
  })

  it('normaliza envelope estilo n8n usando body.data', () => {
    const payload = normalizeWhatsAppPayload({
      body: {
        sender: '595974222999@s.whatsapp.net',
        data: {
          key: { remoteJid: '595971525301@s.whatsapp.net', id: 'MSG-2' },
          message: { conversation: '#TRANSACCION Cliente Ana: 500$ - 15%' },
          messageTimestamp: 1779326122,
          pushName: 'Gabriel',
          messageType: 'conversation',
        },
      },
    })

    expect(payload).toMatchObject({
      chatId: '595971525301@s.whatsapp.net',
      messageId: 'MSG-2',
      sourceShape: 'enveloped-webhook',
      content: '#TRANSACCION Cliente Ana: 500$ - 15%',
    })
  })

  it('prefiere remoteJidAlt telefonico cuando remoteJid es lid', () => {
    const payload = normalizeWhatsAppPayload({
      data: {
        key: {
          remoteJid: '163904676176039@lid',
          remoteJidAlt: '595971525301@s.whatsapp.net',
          id: 'MSG-LID-1',
        },
        message: { conversation: '#TRANSACCION Cliente Alvaro 76,21$ - 15%' },
        messageTimestamp: 1779311471,
        pushName: 'Gabriel Zambrano',
      },
    })

    expect(payload).toMatchObject({
      chatId: '595971525301@s.whatsapp.net',
      rawChatId: '163904676176039@lid',
      alternateChatIds: ['163904676176039@lid'],
      messageId: 'MSG-LID-1',
    })
  })

  it('usa captions y fallback de messageId a timestamp', () => {
    const payload = normalizeWhatsAppPayload({
      data: {
        key: { remoteJid: '595981000000@s.whatsapp.net' },
        message: { imageMessage: { caption: '#TASA 7400' } },
        messageTimestamp: 1711111111,
      },
    })

    expect(payload).toMatchObject({
      chatId: '595981000000@s.whatsapp.net',
      messageId: '1711111111',
      content: '#TASA 7400',
      messageType: 'imageMessage',
      timestamp: '1711111111',
    })
  })

  it('acepta payload plano normalizado', () => {
    const payload = normalizeWhatsAppPayload({
      sender: '595981000000@s.whatsapp.net',
      conversation: '#TASA 7500',
      messageTimestamp: 1712222222,
      pushName: 'Plano',
    })

    expect(payload).toMatchObject({
      chatId: '595981000000@s.whatsapp.net',
      sourceShape: 'flat-normalized',
      content: '#TASA 7500',
    })
  })

  it('devuelve null si no encuentra contenido ni chat util', () => {
    expect(normalizeWhatsAppPayload({ foo: 'bar' })).toBeNull()
  })

  it('devuelve null si el mensaje es del propio bot (fromMe)', () => {
    expect(normalizeWhatsAppPayload({
      data: {
        key: { remoteJid: '595981000000@s.whatsapp.net', id: 'MSG-OUT-1', fromMe: true },
        message: { conversation: '💸 TRANSACCIÓN CONFIRMADA 💸' },
        messageTimestamp: 1710000001,
        pushName: 'Bot',
      },
    })).toBeNull()
  })

  it('mantiene la misma idempotency key cuando messageId es estable', () => {
    expect(generarIdempotencyKey('MSG-42', '163904676176039@lid', '1710000000', '#TASA 7300'))
      .toBe('MSG-42')

    expect(generarIdempotencyKey('MSG-42', '595981000000@s.whatsapp.net', '1710000000', '#TASA 7300'))
      .toBe('MSG-42')
  })
})
