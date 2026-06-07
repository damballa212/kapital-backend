import { app } from '@azure/functions'
import { handleAzureRequest } from '../azure-bridge.js'

app.http('api', {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: '{*route}',
  handler: (request) => handleAzureRequest(request),
})
