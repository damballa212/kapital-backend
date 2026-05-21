import { sql } from '../db/postgres.js'
import type { TransactionSql } from 'postgres'
import type {
  Transaction,
  TransactionInsert,
  FiltroTransacciones,
  FiltroReporte,
  MetricasHoy,
  MetricasMes,
  ColaboradorMetrica,
  ClienteMetrica,
  DiaMetrica,
} from '../domain/transaction.js'

export async function insertTransaction(
  data: TransactionInsert,
  tx?: TransactionSql
): Promise<number> {
  const runner = tx ?? sql
  const rows = await runner<[{ id: number }]>`
    INSERT INTO transactions (
      idempotency_key, fecha, chat_id, colaborador, cliente,
      usd_total, comision, usd_neto, monto_gs,
      monto_colaborador_gs, monto_colaborador_usd,
      monto_comision_gabriel_gs, monto_comision_gabriel_usd,
      tasa_usada, observaciones
    ) VALUES (
      ${data.idempotencyKey}, ${data.fecha}, ${data.chatId}, ${data.colaborador}, ${data.cliente},
      ${data.usdTotal}, ${data.comision}, ${data.usdNeto}, ${data.montoGs},
      ${data.montoColaboradorGs}, ${data.montoColaboradorUsd},
      ${data.montoComisionGabrielGs}, ${data.montoComisionGabrielUsd},
      ${data.tasaUsada}, ${data.observaciones}
    )
    RETURNING id
  `
  return rows[0].id
}

function mapRow(r: Record<string, unknown>): Transaction {
  return {
    id: r.id as number,
    idempotencyKey: r.idempotency_key as string,
    fecha: r.fecha as Date,
    chatId: r.chat_id as string,
    colaborador: r.colaborador as string | null,
    cliente: r.cliente as string,
    usdTotal: parseFloat(r.usd_total as string),
    comision: parseFloat(r.comision as string),
    usdNeto: parseFloat(r.usd_neto as string),
    montoGs: parseFloat(r.monto_gs as string),
    montoColaboradorGs: parseFloat(r.monto_colaborador_gs as string),
    montoColaboradorUsd: parseFloat(r.monto_colaborador_usd as string),
    montoComisionGabrielGs: parseFloat(r.monto_comision_gabriel_gs as string),
    montoComisionGabrielUsd: parseFloat(r.monto_comision_gabriel_usd as string),
    tasaUsada: parseFloat(r.tasa_usada as string),
    observaciones: r.observaciones as string | null,
  }
}

export async function findTransactions(
  filtros: FiltroTransacciones
): Promise<{ data: Transaction[]; total: number }> {
  const offset = (filtros.page - 1) * filtros.limit

  const conditions = sql`
    ${filtros.startDate ? sql`AND fecha >= ${filtros.startDate}::timestamptz` : sql``}
    ${filtros.endDate ? sql`AND fecha <= ${filtros.endDate}::timestamptz + INTERVAL '1 day'` : sql``}
    ${filtros.colaborador ? sql`AND LOWER(colaborador) = LOWER(${filtros.colaborador})` : sql``}
    ${filtros.cliente ? sql`AND LOWER(cliente) LIKE LOWER(${'%' + filtros.cliente + '%'})` : sql``}
  `

  const [rows, countRows] = await Promise.all([
    sql<Record<string, unknown>[]>`
      SELECT * FROM transactions
      WHERE 1=1 ${conditions}
      ORDER BY fecha DESC
      LIMIT ${filtros.limit} OFFSET ${offset}
    `,
    sql<[{ count: string }]>`
      SELECT COUNT(*)::text AS count
      FROM transactions
      WHERE 1=1 ${conditions}
    `,
  ])

  return {
    data: rows.map(mapRow),
    total: parseInt(countRows[0].count, 10),
  }
}

export async function findTransactionsForExport(filtros: FiltroReporte): Promise<Transaction[]> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT * FROM transactions
    WHERE 1=1
    ${filtros.startDate  ? sql`AND fecha >= ${filtros.startDate}::timestamptz` : sql``}
    ${filtros.endDate    ? sql`AND fecha <= ${filtros.endDate}::timestamptz + INTERVAL '1 day'` : sql``}
    ${filtros.colaborador ? sql`AND LOWER(colaborador) = LOWER(${filtros.colaborador})` : sql``}
    ${filtros.cliente    ? sql`AND LOWER(cliente) LIKE LOWER(${'%' + filtros.cliente + '%'})` : sql``}
    ${filtros.minAmount  ? sql`AND usd_total >= ${filtros.minAmount}` : sql``}
    ${filtros.maxAmount  ? sql`AND usd_total <= ${filtros.maxAmount}` : sql``}
    ORDER BY fecha DESC
    LIMIT 10000
  `
  return rows.map(mapRow)
}

export async function getExportPreview(filtros: FiltroReporte): Promise<{ total: number; totalUsd: number; totalGs: number; comisionGabrielUsd: number }> {
  const rows = await sql<[{ total: string; total_usd: string; total_gs: string; comision_gabriel_usd: string }]>`
    SELECT
      COUNT(*)::text                                    AS total,
      COALESCE(SUM(usd_total), 0)::text                AS total_usd,
      COALESCE(SUM(monto_gs), 0)::text                 AS total_gs,
      COALESCE(SUM(monto_comision_gabriel_usd), 0)::text AS comision_gabriel_usd
    FROM transactions
    WHERE 1=1
    ${filtros.startDate  ? sql`AND fecha >= ${filtros.startDate}::timestamptz` : sql``}
    ${filtros.endDate    ? sql`AND fecha <= ${filtros.endDate}::timestamptz + INTERVAL '1 day'` : sql``}
    ${filtros.colaborador ? sql`AND LOWER(colaborador) = LOWER(${filtros.colaborador})` : sql``}
    ${filtros.cliente    ? sql`AND LOWER(cliente) LIKE LOWER(${'%' + filtros.cliente + '%'})` : sql``}
    ${filtros.minAmount  ? sql`AND usd_total >= ${filtros.minAmount}` : sql``}
    ${filtros.maxAmount  ? sql`AND usd_total <= ${filtros.maxAmount}` : sql``}
  `
  const r = rows[0]
  return {
    total: parseInt(r.total, 10),
    totalUsd: parseFloat(r.total_usd),
    totalGs: parseFloat(r.total_gs),
    comisionGabrielUsd: parseFloat(r.comision_gabriel_usd),
  }
}

export async function getMetricasHoy(): Promise<MetricasHoy> {
  const rows = await sql<[{
    total_transacciones: string
    total_usd: string
    total_gs: string
    comision_gabriel_usd: string
    comision_gabriel_gs: string
  }]>`
    SELECT
      COUNT(*)::text                              AS total_transacciones,
      COALESCE(SUM(usd_total), 0)::text          AS total_usd,
      COALESCE(SUM(monto_gs), 0)::text           AS total_gs,
      COALESCE(SUM(monto_comision_gabriel_usd), 0)::text AS comision_gabriel_usd,
      COALESCE(SUM(monto_comision_gabriel_gs), 0)::text  AS comision_gabriel_gs
    FROM transactions
    WHERE fecha >= DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Asuncion') AT TIME ZONE 'America/Asuncion'
      AND fecha <  DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Asuncion') AT TIME ZONE 'America/Asuncion' + INTERVAL '1 day'
  `
  const r = rows[0]
  return {
    totalTransacciones: parseInt(r.total_transacciones, 10),
    totalUsd: parseFloat(r.total_usd),
    totalGs: parseFloat(r.total_gs),
    comisionGabrielUsd: parseFloat(r.comision_gabriel_usd),
    comisionGabrielGs: parseFloat(r.comision_gabriel_gs),
  }
}

export async function getMetricasMes(year: number, month: number): Promise<MetricasMes> {
  const rows = await sql<[{
    total_transacciones: string
    total_usd: string
    total_gs: string
    comision_gabriel_usd: string
    comision_gabriel_gs: string
  }]>`
    SELECT
      COUNT(*)::text                              AS total_transacciones,
      COALESCE(SUM(usd_total), 0)::text          AS total_usd,
      COALESCE(SUM(monto_gs), 0)::text           AS total_gs,
      COALESCE(SUM(monto_comision_gabriel_usd), 0)::text AS comision_gabriel_usd,
      COALESCE(SUM(monto_comision_gabriel_gs), 0)::text  AS comision_gabriel_gs
    FROM transactions
    WHERE EXTRACT(YEAR  FROM fecha AT TIME ZONE 'America/Asuncion') = ${year}
      AND EXTRACT(MONTH FROM fecha AT TIME ZONE 'America/Asuncion') = ${month}
  `
  const r = rows[0]
  return {
    year,
    month,
    totalTransacciones: parseInt(r.total_transacciones, 10),
    totalUsd: parseFloat(r.total_usd),
    totalGs: parseFloat(r.total_gs),
    comisionGabrielUsd: parseFloat(r.comision_gabriel_usd),
    comisionGabrielGs: parseFloat(r.comision_gabriel_gs),
  }
}

export async function getPerformanceColaboradores(
  inicio: string,
  fin: string
): Promise<ColaboradorMetrica[]> {
  return sql<ColaboradorMetrica[]>`
    SELECT
      colaborador,
      COUNT(*)::int                                    AS "totalTransacciones",
      COALESCE(SUM(usd_total), 0)::float               AS "totalUsd",
      COALESCE(SUM(monto_colaborador_usd), 0)::float   AS "comisionUsd"
    FROM transactions
    WHERE colaborador IS NOT NULL
      AND fecha BETWEEN ${inicio}::timestamptz AND ${fin}::timestamptz
    GROUP BY colaborador
    ORDER BY "totalUsd" DESC
  `
}

export async function getTopClientes(limit: number): Promise<ClienteMetrica[]> {
  return sql<ClienteMetrica[]>`
    SELECT
      cliente,
      COUNT(*)::int            AS "totalTransacciones",
      COALESCE(SUM(usd_total), 0)::float AS "totalUsd"
    FROM transactions
    GROUP BY cliente
    ORDER BY "totalUsd" DESC
    LIMIT ${limit}
  `
}

export async function getDailyMetrics(inicio: string, fin: string): Promise<DiaMetrica[]> {
  return sql<DiaMetrica[]>`
    SELECT
      DATE(fecha AT TIME ZONE 'America/Asuncion')::text AS fecha,
      COUNT(*)::int            AS "totalTransacciones",
      COALESCE(SUM(usd_total), 0)::float AS "totalUsd"
    FROM transactions
    WHERE fecha BETWEEN ${inicio}::timestamptz AND ${fin}::timestamptz
    GROUP BY DATE(fecha AT TIME ZONE 'America/Asuncion')
    ORDER BY fecha ASC
  `
}

export async function deleteTransaction(id: number): Promise<boolean> {
  const rows = await sql<[{ id: number }?]>`
    DELETE FROM transactions WHERE id = ${id} RETURNING id
  `
  return rows.length > 0
}
