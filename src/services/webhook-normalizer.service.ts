import type { WhatsAppPayload, WhatsAppPayloadSourceShape } from '../domain/webhook.js'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function detectShape(body: Record<string, unknown>): {
  shape: WhatsAppPayloadSourceShape
  bodyRecord: Record<string, unknown>
  dataRecord: Record<string, unknown>
} {
  const bodyRecord = asRecord(body.body)
  const directData = asRecord(body.data)

  if (Object.keys(bodyRecord).length > 0 && Object.keys(asRecord(bodyRecord.data)).length > 0) {
    return {
      shape: 'enveloped-webhook',
      bodyRecord,
      dataRecord: asRecord(bodyRecord.data),
    }
  }

  if (Object.keys(directData).length > 0) {
    return {
      shape: 'direct-evolution',
      bodyRecord: body,
      dataRecord: directData,
    }
  }

  return {
    shape: 'flat-normalized',
    bodyRecord: body,
    dataRecord: body,
  }
}

function pickMessageContent(message: Record<string, unknown>, body: Record<string, unknown>) {
  if (typeof message.conversation === 'string' && message.conversation) {
    return { content: message.conversation, messageType: 'conversation' }
  }

  const extended = asRecord(message.extendedTextMessage)
  if (typeof extended.text === 'string' && extended.text) {
    return { content: extended.text, messageType: 'extendedTextMessage' }
  }

  const image = asRecord(message.imageMessage)
  if (typeof image.caption === 'string' && image.caption) {
    return { content: image.caption, messageType: 'imageMessage' }
  }

  const video = asRecord(message.videoMessage)
  if (typeof video.caption === 'string' && video.caption) {
    return { content: video.caption, messageType: 'videoMessage' }
  }

  if (typeof body.conversation === 'string' && body.conversation) {
    return { content: body.conversation, messageType: 'conversation' }
  }

  return {
    content: '',
    messageType: typeof body.messageType === 'string' ? body.messageType : 'unknown',
  }
}

export function normalizeWhatsAppPayload(body: Record<string, unknown>): WhatsAppPayload | null {
  const { shape, bodyRecord, dataRecord } = detectShape(body)
  const key = asRecord(dataRecord.key)
  const message = asRecord(dataRecord.message)
  const contentInfo = pickMessageContent(message, bodyRecord)

  const candidates = unique([
    typeof key.remoteJid === 'string' ? key.remoteJid : undefined,
    typeof key.remoteJidAlt === 'string' ? key.remoteJidAlt : undefined,
    typeof dataRecord.remoteJid === 'string' ? dataRecord.remoteJid : undefined,
    typeof dataRecord.sender === 'string' ? dataRecord.sender : undefined,
    typeof bodyRecord.sender === 'string' ? bodyRecord.sender : undefined,
  ])

  const rawChatId = candidates[0] ?? ''
  const chatId = candidates.find(value => value.endsWith('@s.whatsapp.net')) ?? rawChatId
  const alternateChatIds = candidates.filter(value => value !== chatId)

  const timestampValue =
    dataRecord.messageTimestamp ??
    bodyRecord.messageTimestamp ??
    Date.now()

  const timestamp = String(timestampValue)
  const messageId =
    (typeof key.id === 'string' && key.id) ||
    timestamp

  const userName =
    (typeof dataRecord.pushName === 'string' && dataRecord.pushName) ||
    (typeof bodyRecord.pushName === 'string' && bodyRecord.pushName) ||
    ''

  const messageType =
    (typeof dataRecord.messageType === 'string' && dataRecord.messageType) ||
    (typeof bodyRecord.messageType === 'string' && bodyRecord.messageType) ||
    contentInfo.messageType

  if (!chatId || !contentInfo.content) return null

  return {
    chatId,
    rawChatId,
    alternateChatIds,
    content: contentInfo.content,
    messageId,
    timestamp,
    userName,
    messageType,
    sourceShape: shape,
  }
}
