import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import type { HttpRequest, HttpResponseInit } from '@azure/functions'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirebaseServiceAccount } from './config/firebaseAdmin.js'
import { createApp } from './app.js'

const sa = getFirebaseServiceAccount()
if (sa) {
  initializeApp({ credential: cert(sa) })
} else {
  initializeApp()
}

const expressApp = createApp()

export async function handleAzureRequest(req: HttpRequest): Promise<HttpResponseInit> {
  const url = new URL(req.url)
  const bodyBuffer = req.body ? Buffer.from(await req.arrayBuffer()) : Buffer.alloc(0)

  return new Promise((resolve) => {
    const nodeReq = new IncomingMessage(new Socket())
    nodeReq.method = req.method
    nodeReq.url = url.pathname + url.search
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(nodeReq as any).headers = Object.fromEntries(req.headers.entries())
    nodeReq.push(bodyBuffer)
    nodeReq.push(null)

    const chunks: Buffer[] = []
    const nodeRes = new ServerResponse(nodeReq)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(nodeRes as any).write = (chunk: unknown) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
      return true
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(nodeRes as any).end = (chunk?: unknown) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))

      const body = Buffer.concat(chunks)
      const headers: Record<string, string> = {}

      for (const [k, v] of Object.entries(nodeRes.getHeaders())) {
        if (v !== undefined) {
          headers[k] = Array.isArray(v) ? v.join(', ') : String(v)
        }
      }

      resolve({
        status: nodeRes.statusCode,
        headers,
        body: body.length > 0 ? body : undefined,
      })

      return nodeRes
    }

    expressApp(nodeReq as Parameters<typeof expressApp>[0], nodeRes as Parameters<typeof expressApp>[1])
  })
}
