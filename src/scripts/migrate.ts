import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { sql } from '../db/postgres.js'

type MigrationRow = {
  version: string
}

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations')

async function ensureMigrationsTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
}

async function getAppliedVersions(): Promise<Set<string>> {
  const rows = await sql<MigrationRow[]>`
    SELECT version
    FROM schema_migrations
    ORDER BY version ASC
  `

  return new Set(rows.map((row) => row.version))
}

async function getMigrationFiles(): Promise<string[]> {
  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile() && /^\d+_.+\.sql$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
}

async function applyMigration(fileName: string): Promise<void> {
  const filePath = path.join(MIGRATIONS_DIR, fileName)
  const contents = await fs.readFile(filePath, 'utf8')

  await sql.begin(async (tx) => {
    await tx.unsafe(contents)
    await tx`
      INSERT INTO schema_migrations (version)
      VALUES (${fileName})
    `
  })
}

export async function runMigrations(): Promise<void> {
  await ensureMigrationsTable()

  const applied = await getAppliedVersions()
  const files = await getMigrationFiles()
  const pending = files.filter((file) => !applied.has(file))

  if (pending.length === 0) {
    console.log('No pending migrations')
    return
  }

  for (const file of pending) {
    console.log(`Applying migration: ${file}`)
    await applyMigration(file)
  }

  console.log(`Applied ${pending.length} migration(s)`)
}

// Cuando se corre como script standalone: node lib/scripts/migrate.js
if (process.argv[1]?.endsWith('migrate.js') || process.argv[1]?.endsWith('migrate.ts')) {
  runMigrations()
    .then(() => sql.end())
    .catch(async (error: unknown) => {
      console.error('Migration failed', error)
      await sql.end({ timeout: 1 })
      process.exit(1)
    })
}
