import express from 'express'
import { handleWhatsAppWebhook } from './handlers/webhook.handler.js'
import { handleGetTransacciones, handleDeleteTransaccion } from './handlers/transactions.handler.js'
import { handleGetDashboard } from './handlers/dashboard.handler.js'
import { handleExport, handleExportPreview } from './handlers/reports.handler.js'
import { handleGetTasa } from './handlers/rates.handler.js'
import {
  handleGetColaboradores,
  handleCreateColaborador,
  handleUpdateColaborador,
  handleDeleteColaborador,
} from './handlers/collaborators.handler.js'
import { handleGetPresets, handleSavePreset, handleDeletePreset } from './handlers/presets.handler.js'
import { handleGetWebhookMessage, handleGetWebhookMessages } from './handlers/webhookMessages.handler.js'
import { withAuth } from './middleware/auth.js'
import { verifyEvolutionSecret } from './middleware/webhookAuth.js'
import { handleSSE } from './handlers/sse.handler.js'
import { sql } from './db/postgres.js'

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'https://kapital-app-prod.web.app'

export function createApp(): express.Express {
  const app = express()

  app.use((req, res, next) => {
    const origin = req.headers.origin
    if (origin === ALLOWED_ORIGIN || !origin) {
      res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })

  app.use(express.json({ limit: '1mb' }))

  app.post('/webhook/whatsapp', verifyEvolutionSecret, handleWhatsAppWebhook)
  app.get('/webhook/messages',   withAuth(handleGetWebhookMessages))
  app.get('/webhook/messages/:id', withAuth(handleGetWebhookMessage))
  app.get('/transactions',           withAuth(handleGetTransacciones))
  app.delete('/transactions/:id',    withAuth(handleDeleteTransaccion))
  app.get('/dashboard',          withAuth(handleGetDashboard))
  app.get('/export/preview',     withAuth(handleExportPreview))
  app.get('/export',             withAuth(handleExport))
  app.get('/rates/current',           withAuth(handleGetTasa))
  app.get('/collaborators',           withAuth(handleGetColaboradores))
  app.post('/collaborators',          withAuth(handleCreateColaborador))
  app.put('/collaborators/:id',       withAuth(handleUpdateColaborador))
  app.delete('/collaborators/:id',    withAuth(handleDeleteColaborador))
  app.get('/export/presets',     withAuth(handleGetPresets))
  app.post('/export/presets',    withAuth(handleSavePreset))
  app.delete('/export/presets/:id', withAuth(handleDeletePreset))
  app.get('/realtime/events', handleSSE)
  app.get('/health', async (_req, res) => {
    try {
      await sql`SELECT 1`
      res.json({ status: 'ok', db: 'ok' })
    } catch {
      res.status(503).json({ status: 'error', db: 'unreachable' })
    }
  })

  return app
}
