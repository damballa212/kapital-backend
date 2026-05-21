import { sql } from '../db/postgres.js'
import type { WhatsAppPayload } from '../domain/webhook.js'
import type {
  WhatsappFlowEvent,
  WhatsappInboundMessage,
  WhatsappLogPatch,
  WhatsappMessageFilters,
  WhatsappSummary,
} from '../domain/whatsappLog.js'

function mapMessageRow(r: Record<string, unknown>): WhatsappInboundMessage {
  return {
    id: r.id as number,
    messageId: r.message_id as string,
    chatId: r.chat_id as string,
    userName: r.user_name as string | null,
    content: r.content as string,
    receivedAt: r.received_at as Date,
    parsedType: r.parsed_type as WhatsappInboundMessage['parsedType'],
    status: r.status as WhatsappInboundMessage['status'],
    flowStage: r.flow_stage as string,
    transactionId: r.transaction_id as number | null,
    errorMessage: r.error_message as string | null,
    processingStartedAt: r.processing_started_at as Date,
    processingFinishedAt: r.processing_finished_at as Date | null,
    durationMs: r.duration_ms as number | null,
  }
}

function mapEventRow(r: Record<string, unknown>): WhatsappFlowEvent {
  return {
    id: r.id as number,
    messageLogId: r.message_log_id as number,
    stage: r.stage as string,
    status: r.status as WhatsappFlowEvent['status'],
    details: r.details as Record<string, unknown> | null,
    createdAt: r.created_at as Date,
  }
}

function buildConditions(filters: WhatsappMessageFilters) {
  return sql`
    ${filters.startDate ? sql`AND received_at >= ${filters.startDate}::timestamptz` : sql``}
    ${filters.endDate ? sql`AND received_at <= ${filters.endDate}::timestamptz + INTERVAL '1 day'` : sql``}
    ${filters.status ? sql`AND status = ${filters.status}` : sql``}
    ${filters.parsedType ? sql`AND parsed_type = ${filters.parsedType}` : sql``}
    ${filters.q ? sql`AND (
      content ILIKE ${'%' + filters.q + '%'}
      OR chat_id ILIKE ${'%' + filters.q + '%'}
      OR user_name ILIKE ${'%' + filters.q + '%'}
      OR error_message ILIKE ${'%' + filters.q + '%'}
    )` : sql``}
  `
}

function payloadTimestampToDate(timestamp: string): Date {
  const numeric = Number(timestamp)
  if (!Number.isFinite(numeric)) return new Date()
  return new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
}

export async function createInboundMessageLog(
  payload: WhatsAppPayload,
  rawPayload: Record<string, unknown>
): Promise<number> {
  const rows = await sql<[{ id: number }]>`
    INSERT INTO whatsapp_inbound_messages (
      message_id, chat_id, user_name, content, received_at,
      raw_payload, status, flow_stage, processing_started_at, updated_at
    ) VALUES (
      ${payload.messageId}, ${payload.chatId}, ${payload.userName || null}, ${payload.content},
      ${payloadTimestampToDate(payload.timestamp)}, ${JSON.stringify(rawPayload)}::jsonb,
      'received', 'received', NOW(), NOW()
    )
    ON CONFLICT (message_id)
    DO UPDATE SET
      raw_payload = EXCLUDED.raw_payload,
      updated_at = NOW()
    RETURNING id
  `
  return rows[0].id
}

export async function recordWebhookFlowEvent(
  messageLogId: number,
  event: { stage: string; status: 'ok' | 'failed' | 'skipped'; details?: Record<string, unknown> }
): Promise<void> {
  await sql`
    INSERT INTO whatsapp_flow_events (message_log_id, stage, status, details)
    VALUES (${messageLogId}, ${event.stage}, ${event.status}, ${JSON.stringify(event.details ?? null)}::jsonb)
  `
}

export async function updateInboundMessageLog(
  id: number,
  patch: WhatsappLogPatch
): Promise<void> {
  await sql`
    UPDATE whatsapp_inbound_messages
    SET
      status = COALESCE(${patch.status ?? null}, status),
      flow_stage = COALESCE(${patch.flowStage ?? null}, flow_stage),
      parsed_type = COALESCE(${patch.parsedType ?? null}, parsed_type),
      transaction_id = COALESCE(${patch.transactionId ?? null}, transaction_id),
      error_message = COALESCE(${patch.errorMessage ?? null}, error_message),
      processing_finished_at = CASE WHEN ${patch.finish ?? false} THEN NOW() ELSE processing_finished_at END,
      duration_ms = CASE
        WHEN ${patch.finish ?? false} THEN EXTRACT(EPOCH FROM (NOW() - processing_started_at)) * 1000
        ELSE duration_ms
      END,
      updated_at = NOW()
    WHERE id = ${id}
  `
}

export async function findInboundMessages(
  filters: WhatsappMessageFilters
): Promise<{ data: WhatsappInboundMessage[]; total: number }> {
  const offset = (filters.page - 1) * filters.limit
  const conditions = buildConditions(filters)

  const [rows, countRows] = await Promise.all([
    sql<Record<string, unknown>[]>`
      SELECT * FROM whatsapp_inbound_messages
      WHERE 1=1 ${conditions}
      ORDER BY received_at DESC, id DESC
      LIMIT ${filters.limit} OFFSET ${offset}
    `,
    sql<[{ count: string }]>`
      SELECT COUNT(*)::text AS count
      FROM whatsapp_inbound_messages
      WHERE 1=1 ${conditions}
    `,
  ])

  return {
    data: rows.map(mapMessageRow),
    total: parseInt(countRows[0].count, 10),
  }
}

export async function getInboundMessageSummary(filters: WhatsappMessageFilters): Promise<WhatsappSummary> {
  const conditions = buildConditions(filters)
  const rows = await sql<[{
    total: string
    completed: string
    failed: string
    parse_errors: string
  }]>`
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE status IN ('confirmation_sent', 'transaction_created', 'rate_updated'))::text AS completed,
      COUNT(*) FILTER (WHERE status IN ('failed', 'confirmation_failed', 'parse_error', 'rate_limited'))::text AS failed,
      COUNT(*) FILTER (WHERE status = 'parse_error')::text AS parse_errors
    FROM whatsapp_inbound_messages
    WHERE 1=1 ${conditions}
  `

  const r = rows[0]
  return {
    total: parseInt(r.total, 10),
    completed: parseInt(r.completed, 10),
    failed: parseInt(r.failed, 10),
    parseErrors: parseInt(r.parse_errors, 10),
  }
}

export async function getInboundMessageDetail(
  id: number
): Promise<{ message: WhatsappInboundMessage; events: WhatsappFlowEvent[] } | null> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT * FROM whatsapp_inbound_messages WHERE id = ${id}
  `
  if (rows.length === 0) return null

  const events = await sql<Record<string, unknown>[]>`
    SELECT * FROM whatsapp_flow_events
    WHERE message_log_id = ${id}
    ORDER BY created_at ASC, id ASC
  `

  return {
    message: mapMessageRow(rows[0]),
    events: events.map(mapEventRow),
  }
}
