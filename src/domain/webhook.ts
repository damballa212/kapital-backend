export type WhatsAppPayloadSourceShape =
  | 'direct-evolution'
  | 'enveloped-webhook'
  | 'flat-normalized'

export type WhatsAppPayload = {
  chatId: string
  rawChatId: string
  alternateChatIds: string[]
  content: string
  messageId: string
  timestamp: string
  userName: string
  messageType: string
  sourceShape: WhatsAppPayloadSourceShape
}

export type ParsedTasa = {
  type: 'TASA'
  tasa: number
}

export type ParsedTransaccion = {
  type: 'TRANSACCION'
  colaborador: string | null
  overridePct: number | null
  cliente: string
  usdTotal: number
  comisionPct: number
  usdNeto: number | null
  montoGs: number | null
}

export type ParseError = {
  type: 'ERROR'
  mensaje: string
}

export type ParseResult = ParsedTasa | ParsedTransaccion | ParseError
