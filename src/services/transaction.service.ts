import { sql } from '../db/postgres.js'
import type { TransactionSql } from 'postgres'
import { generarIdempotencyKey } from '../utils/idempotency.js'
import { insertTransaction } from '../repositories/transaction.repository.js'
import { resolverColaboradorDb } from './collaborator.service.js'
import { emit } from './eventBus.js'
import type { ParsedTransaccion, WhatsAppPayload } from '../domain/webhook.js'
import type { ComisionesCalculadas } from '../domain/transaction.js'

export class DuplicateTransactionError extends Error {
  constructor(public readonly idempotencyKey: string) {
    super('duplicate_transaction')
  }
}

export function resolverColaborador(
  nombre: string | null,
  comisionPct: number,
  overridePct: number | null
): { colaborador: string; pct: number } {
  if (!nombre) return { colaborador: 'Gabriel Zambrano', pct: 0 }

  const n = nombre.toLowerCase()

  if (n.includes('gabriel') || n.includes('gabo')) {
    return { colaborador: 'Gabriel Zambrano', pct: 0 }
  }
  if (n.includes('patty') || n.includes('paty')) {
    return { colaborador: 'Patty', pct: 5 }
  }
  if (n.includes('anael') || n.includes('anel')) {
    const pct = overridePct ?? (comisionPct === 10 ? 2 : 5)
    return { colaborador: 'Anael', pct }
  }

  if (overridePct === null) {
    throw new Error(
      `Colaborador nuevo sin porcentaje. Reenviar como: 'Colaborador ${nombre} (X%) Cliente ...'`
    )
  }
  return { colaborador: nombre.trim(), pct: overridePct }
}

export function calcularComisiones(
  parsed: ParsedTransaccion,
  tasa: number,
  preResolved?: { colaborador: string; pct: number }
): ComisionesCalculadas {
  const { colaborador: nombreRaw, usdTotal, comisionPct, overridePct, cliente } = parsed
  const { colaborador, pct: pctColaborador } = preResolved ?? resolverColaborador(nombreRaw, comisionPct, overridePct)

  const comisionTotalUsd = usdTotal * (comisionPct / 100)
  const usdNeto = usdTotal - comisionTotalUsd
  const comisionColaboradorUsd = usdTotal * (pctColaborador / 100)
  const comisionGabrielUsd = comisionTotalUsd - comisionColaboradorUsd
  const montoGs = Math.round(usdNeto * tasa)
  const comisionColaboradorGs = Math.round(comisionColaboradorUsd * tasa)
  const comisionGabrielGs = Math.round(comisionGabrielUsd * tasa)

  return {
    colaborador,
    porcentajeColaborador: pctColaborador,
    usdNeto,
    montoGs,
    comisionTotalUsd,
    comisionColaboradorUsd,
    comisionGabrielUsd,
    comisionColaboradorGs,
    comisionGabrielGs,
    tasaUsada: tasa,
    cliente,
    usdTotal,
    comisionPct,
  }
}

export async function procesarTransaccion(
  parsed: ParsedTransaccion,
  meta: WhatsAppPayload,
  tasa: number
): Promise<ComisionesCalculadas> {
  const preResolved = await resolverColaboradorDb(parsed.colaborador, parsed.comisionPct, parsed.overridePct)
  const comisiones = calcularComisiones(parsed, tasa, preResolved)
  const idempotencyKey = generarIdempotencyKey(
    meta.messageId,
    meta.chatId,
    meta.timestamp,
    meta.content
  )
  let transactionId: number | undefined
  let isDuplicate = false

  await sql.begin(async (tx: TransactionSql) => {
    transactionId = await insertTransaction({
      idempotencyKey,
      fecha: new Date(),
      chatId: meta.chatId,
      colaborador: comisiones.colaborador !== 'Gabriel Zambrano' || parsed.colaborador ? comisiones.colaborador : null,
      cliente: comisiones.cliente,
      usdTotal: comisiones.usdTotal,
      comision: comisiones.comisionPct,
      usdNeto: comisiones.usdNeto,
      montoGs: comisiones.montoGs,
      montoColaboradorGs: comisiones.comisionColaboradorGs,
      montoColaboradorUsd: comisiones.comisionColaboradorUsd,
      montoComisionGabrielGs: comisiones.comisionGabrielGs,
      montoComisionGabrielUsd: comisiones.comisionGabrielUsd,
      tasaUsada: comisiones.tasaUsada,
      observaciones: null,
    }, tx)

    if (transactionId === undefined) {
      isDuplicate = true
      return
    }

    await tx`
      INSERT INTO clients (name, tx_count, created_at, updated_at)
      VALUES (${comisiones.cliente}, 1, NOW(), NOW())
      ON CONFLICT (LOWER(name))
      DO UPDATE SET tx_count = clients.tx_count + 1, updated_at = NOW()
    `

    await tx`
      INSERT INTO collaborators (name, base_pct_usd_total, tx_count, created_at, updated_at)
      VALUES (${comisiones.colaborador}, ${comisiones.porcentajeColaborador}, 1, NOW(), NOW())
      ON CONFLICT (LOWER(name))
      DO UPDATE SET
        base_pct_usd_total = COALESCE(EXCLUDED.base_pct_usd_total, collaborators.base_pct_usd_total),
        tx_count = collaborators.tx_count + 1,
        updated_at = NOW()
    `
  })

  if (isDuplicate) throw new DuplicateTransactionError(idempotencyKey)

  emit({ type: 'transaction.created', transactionId: transactionId! })
  return { ...comisiones, transactionId }
}
