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

export function createApp(): express.Express {
  const app = express()

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })

  app.use(express.json({ limit: '1mb' }))

  app.post('/webhook/whatsapp',  handleWhatsAppWebhook)
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
  app.get('/health',             (_req, res) => res.json({ status: 'ok' }))

  return app
}
