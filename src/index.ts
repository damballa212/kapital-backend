import 'dotenv/config'
import express from 'express'
import { handleWhatsAppWebhook } from './handlers/webhook.handler.js'
import { handleGetTransacciones } from './handlers/transactions.handler.js'
import { handleGetDashboard } from './handlers/dashboard.handler.js'
import { handleExport } from './handlers/reports.handler.js'
import { handleGetTasa, handleGetColaboradores } from './handlers/rates.handler.js'
import { withAuth } from './middleware/auth.js'

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
// ─────────────────────────────────────────────────────────────────────────────

// ─── MODO EXPRESS (VPS) ──────────────────────────────────────────────────────
import { initializeApp } from 'firebase-admin/app'
initializeApp()

const app = express()
app.use(express.json({ limit: '1mb' }))

app.post('/webhook/whatsapp',  handleWhatsAppWebhook)
app.get('/transactions',       withAuth(handleGetTransacciones))
app.get('/dashboard',          withAuth(handleGetDashboard))
app.get('/export',             withAuth(handleExport))
app.get('/rates/current',      withAuth(handleGetTasa))
app.get('/collaborators',      withAuth(handleGetColaboradores))
app.get('/health',             (_req, res) => res.json({ status: 'ok' }))

const PORT = process.env.PORT ?? 3000
app.listen(PORT, () => console.log(`Kapital backend running on port ${PORT}`))
// ─────────────────────────────────────────────────────────────────────────────
