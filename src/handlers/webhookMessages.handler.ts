import type { Request, Response } from 'express'
import type { WhatsappInboundStatus, WhatsappParsedType } from '../domain/whatsappLog.js'
import {
  findInboundMessages,
  getInboundMessageDetail,
  getInboundMessageSummary,
} from '../repositories/whatsappLog.repository.js'

const VALID_STATUSES = new Set([
  'received',
  'ignored_group',
  'rate_limited',
  'parse_error',
  'rate_updated',
  'transaction_created',
  'confirmation_sent',
  'confirmation_failed',
  'failed',
])

const VALID_TYPES = new Set(['TRANSACCION', 'TASA', 'ERROR', 'AYUDA'])

export async function handleGetWebhookMessages(req: Request, res: Response): Promise<void> {
  const { startDate, endDate, q } = req.query as Record<string, string>
  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? '50', 10)))
  const statusRaw = req.query.status as string | undefined
  const parsedTypeRaw = req.query.parsedType as string | undefined

  const status = statusRaw && VALID_STATUSES.has(statusRaw)
    ? statusRaw as WhatsappInboundStatus
    : undefined
  const parsedType = parsedTypeRaw && VALID_TYPES.has(parsedTypeRaw)
    ? parsedTypeRaw as Exclude<WhatsappParsedType, null>
    : undefined

  const filters = { page, limit, startDate, endDate, status, parsedType, q }
  const [result, summary] = await Promise.all([
    findInboundMessages(filters),
    getInboundMessageSummary(filters),
  ])

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

  const detail = await getInboundMessageDetail(id)
  if (!detail) { res.status(404).json({ error: 'Mensaje no encontrado' }); return }

  res.json(detail)
}
