import fs from 'node:fs/promises'
import path from 'node:path'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const describeDb = TEST_DATABASE_URL ? describe : describe.skip
const schema = `test_${Date.now()}_${Math.random().toString(36).slice(2)}`
let sql: postgres.Sql | null = null

describeDb('database migrations integration', () => {
  beforeAll(async () => {
    sql = postgres(TEST_DATABASE_URL as string, {
      ssl: 'require',
      max: 1,
      idle_timeout: 5,
      prepare: false,
    })
    await sql.unsafe(`CREATE SCHEMA "${schema}"`)
    await sql.unsafe(`SET search_path TO "${schema}"`)

    const migrationsDir = path.join(process.cwd(), 'migrations')
    const files = (await fs.readdir(migrationsDir))
      .filter(file => /^\d+_.+\.sql$/.test(file))
      .sort()

    for (const file of files) {
      await sql.unsafe(await fs.readFile(path.join(migrationsDir, file), 'utf8'))
    }
  })

  afterAll(async () => {
    if (!sql) return
    await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    await sql.end()
  })

  it('creates transaction and WhatsApp monitor tables that work together', async () => {
    if (!sql) throw new Error('No test database connection')

    const transactionRows = await sql<{ id: number }[]>`
      INSERT INTO transactions (
        idempotency_key, fecha, chat_id, colaborador, cliente,
        usd_total, comision, usd_neto, monto_gs,
        monto_colaborador_gs, monto_colaborador_usd,
        monto_comision_gabriel_gs, monto_comision_gabriel_usd,
        tasa_usada, observaciones
      ) VALUES (
        'db-it-1', NOW(), '595981000000@s.whatsapp.net', 'Anael', 'Cliente DB',
        500, 13, 435, 3175500,
        182500, 25,
        292000, 40,
        7300, null
      )
      RETURNING id
    `

    const messageRows = await sql<{ id: number }[]>`
      INSERT INTO whatsapp_inbound_messages (
        message_id, chat_id, user_name, content, received_at,
        status, flow_stage, transaction_id
      ) VALUES (
        'MSG-DB-1', '595981000000@s.whatsapp.net', 'Operador', '#TRANSACCION Cliente DB: 500$ - 13%', NOW(),
        'confirmation_sent', 'confirmation_sent', ${transactionRows[0].id}
      )
      RETURNING id
    `

    await sql`
      INSERT INTO whatsapp_flow_events (message_log_id, stage, status, details)
      VALUES (${messageRows[0].id}, 'confirmation_sent', 'ok', '{"transactionId": 1}'::jsonb)
    `

    const rows = await sql<{ status: string; event_count: number }[]>`
      SELECT m.status, COUNT(e.id)::int AS event_count
      FROM whatsapp_inbound_messages m
      LEFT JOIN whatsapp_flow_events e ON e.message_log_id = m.id
      WHERE m.message_id = 'MSG-DB-1'
      GROUP BY m.status
    `

    expect(rows).toEqual([{ status: 'confirmation_sent', event_count: 1 }])
  })
})
