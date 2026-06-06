export type WhatsappInboundStatus =
  | 'received'
  | 'ignored_group'
  | 'ignored_duplicate'
  | 'rate_limited'
  | 'parse_error'
  | 'rate_updated'
  | 'transaction_created'
  | 'confirmation_sent'
  | 'confirmation_failed'
  | 'failed'

export type WhatsappFlowEventStatus = 'ok' | 'failed' | 'skipped'

export type WhatsappParsedType = 'TRANSACCION' | 'TASA' | 'HOY' | 'YO' | 'ERROR' | 'AYUDA' | null

export type WhatsappInboundMessage = {
  id: number
  messageId: string
  chatId: string
  userName: string | null
  content: string
  receivedAt: Date
  parsedType: WhatsappParsedType
  status: WhatsappInboundStatus
  flowStage: string
  transactionId: number | null
  errorMessage: string | null
  processingStartedAt: Date
  processingFinishedAt: Date | null
  durationMs: number | null
  responseText: string | null
}

export type WhatsappFlowEvent = {
  id: number
  messageLogId: number
  stage: string
  status: WhatsappFlowEventStatus
  details: Record<string, unknown> | null
  createdAt: Date
}

export type WhatsappMessageFilters = {
  page: number
  limit: number
  startDate?: string
  endDate?: string
  status?: WhatsappInboundStatus
  parsedType?: Exclude<WhatsappParsedType, null>
  q?: string
  chatId?: string
}

export type WhatsappConversation = {
  chatId: string
  userName: string | null
  totalMessages: number
  lastActivity: Date
  lastContent: string
  lastStatus: WhatsappInboundStatus
  failedCount: number
  successCount: number
}

export type WhatsappLogPatch = {
  status?: WhatsappInboundStatus
  flowStage?: string
  parsedType?: Exclude<WhatsappParsedType, null>
  transactionId?: number
  errorMessage?: string
  responseText?: string
  finish?: boolean
}

export type WhatsappSummary = {
  total: number
  completed: number
  failed: number
  parseErrors: number
}
