import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { withAuth } from '../middleware/auth.js'

describe('withAuth', () => {
  it('resolves after sending 401 when the bearer token is missing', async () => {
    const handler = vi.fn()
    const wrapped = withAuth(handler)
    const res = {
      headersSent: false,
      status: vi.fn(function status(this: Response) {
        return this
      }),
      json: vi.fn(function json(this: Response) {
        this.headersSent = true
        return this
      }),
    } as unknown as Response

    const result = await Promise.race([
      wrapped({ headers: {} } as Request, res).then(() => 'resolved'),
      new Promise(resolve => setTimeout(() => resolve('timeout'), 50)),
    ])

    expect(result).toBe('resolved')
    expect(res.status).toHaveBeenCalledWith(401)
    expect(handler).not.toHaveBeenCalled()
  })
})
