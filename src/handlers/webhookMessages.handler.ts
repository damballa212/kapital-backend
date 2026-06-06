import type { Request, Response } from 'express'
import type { WhatsappInboundStatus, WhatsappParsedType } from '../domain/whatsappLog.js'
import {
  findConversations,
  findInboundMessages,
  getInboundMessageDetail,
  getInboundMessageSummary,
} from '../repositories/whatsappLog.repository.js'

const VALID_STATUSES = new Set([
  'received',
  'ignored_group',
  'ignored_duplicate',
  'rate_limited',
  'parse_error',
  'rate_updated',
  'transaction_created',
  'confirmation_sent',
  'confirmation_failed',
  'failed',
])

const VALID_TYPES = new Set(['TRANSACCION', 'TASA', 'HOY', 'YO', 'ERROR', 'AYUDA'])

function isMissingWebhookTablesError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === '42P01'
  )
}

function sendWebhookSetupRequired(res: Response): void {
  res.status(503).json({
    error: 'Monitor WhatsApp pendiente de migracion',
    setupRequired: true,
    migration: '002_whatsapp_inbound_monitor.sql',
  })
}

export async function handleGetConversations(req: Request, res: Response): Promise<void> {
  const { startDate, endDate, q } = req.query as Record<string, string>
  let conversations
  try {
    conversations = await findConversations({ startDate, endDate, q })
  } catch (error) {
    if (isMissingWebhookTablesError(error)) { sendWebhookSetupRequired(res); return }
    throw error
  }
  res.json({ data: conversations })
}

export async function handleGetWebhookMessages(req: Request, res: Response): Promise<void> {
  const { startDate, endDate, q, chatId } = req.query as Record<string, string>
  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10))
  const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) ?? '50', 10)))
  const statusRaw = req.query.status as string | undefined
  const parsedTypeRaw = req.query.parsedType as string | undefined

  const status = statusRaw && VALID_STATUSES.has(statusRaw)
    ? statusRaw as WhatsappInboundStatus
    : undefined
  const parsedType = parsedTypeRaw && VALID_TYPES.has(parsedTypeRaw)
    ? parsedTypeRaw as Exclude<WhatsappParsedType, null>
    : undefined

  const filters = { page, limit, startDate, endDate, status, parsedType, q, chatId }
  let result
  let summary
  try {
    [result, summary] = await Promise.all([
      findInboundMessages(filters),
      getInboundMessageSummary(filters),
    ])
  } catch (error) {
    if (isMissingWebhookTablesError(error)) {
      sendWebhookSetupRequired(res)
      return
    }
    throw error
  }

  res.json({
    data: result.data,
    summary,
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    },
  })
}

export async function handleGetWebhookMessage(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) { res.status(400).json({ error: 'id invalido' }); return }

  let detail
  try {
    detail = await getInboundMessageDetail(id)
  } catch (error) {
    if (isMissingWebhookTablesError(error)) {
      sendWebhookSetupRequired(res)
      return
    }
    throw error
  }
  if (!detail) { res.status(404).json({ error: 'Mensaje no encontrado' }); return }

  res.json(detail)
}
