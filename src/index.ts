import 'dotenv/config'
import { createApp } from './app.js'

// ─── MODO FIREBASE FUNCTIONS ─────────────────────────────────────────────────
// Para migrar a Firebase: descomentar este bloque, comentar el bloque Express,
// cambiar los imports de express → firebase-functions/v2/https en los handlers,
// y correr: firebase deploy --only functions
//
// import { initializeApp } from 'firebase-admin/app'
// import { onRequest } from 'firebase-functions/v2/https'
// initializeApp()
// const REGION = 'us-central1'
// export const whatsappWebhook  = onRequest({ region: REGION }, handleWhatsAppWebhook)
// export const getTransacciones = onRequest({ region: REGION }, withAuth(handleGetTransacciones))
// export const getDashboard     = onRequest({ region: REGION }, withAuth(handleGetDashboard))
// export const getExport        = onRequest({ region: REGION, timeoutSeconds: 120 }, withAuth(handleExport))
// export const getTasaActual    = onRequest({ region: REGION }, withAuth(handleGetTasa))
// export const getColaboradores = onRequest({ region: REGION }, withAuth(handleGetColaboradores))
// export const getWebhookMessages = onRequest({ region: REGION }, withAuth(handleGetWebhookMessages))
// export const getWebhookMessage  = onRequest({ region: REGION }, withAuth(handleGetWebhookMessage))
// ─────────────────────────────────────────────────────────────────────────────

// ─── MODO EXPRESS (VPS) ──────────────────────────────────────────────────────
import { initializeApp, cert } from 'firebase-admin/app'
import { runMigrations } from './scripts/migrate.js'
import { sql } from './db/postgres.js'
import { getFirebaseServiceAccount } from './config/firebaseAdmin.js'

const sa = getFirebaseServiceAccount()
if (sa) {
  initializeApp({ credential: cert(sa) })
} else {
  initializeApp()
}

await runMigrations()

const app = createApp()

const PORT = process.env.PORT ?? 3000
const server = app.listen(PORT, () => console.log(`Kapital backend running on port ${PORT}`))

async function shutdown() {
  server.close()
  await sql.end({ timeout: 5 })
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT',  shutdown)
// ─────────────────────────────────────────────────────────────────────────────
