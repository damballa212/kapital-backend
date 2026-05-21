function normalizeContent(content: string): string {
  return content.trim().replace(/\s+/g, ' ')
}

export function generarIdempotencyKey(
  messageId: string,
  chatId: string,
  timestamp: string,
  content = ''
): string {
  if (messageId) return messageId
  return `${chatId}|${timestamp}|${normalizeContent(content)}`
}
