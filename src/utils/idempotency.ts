export function generarIdempotencyKey(messageId: string, chatId: string, timestamp: string): string {
  return `${messageId}|${chatId}|${timestamp}`
}
