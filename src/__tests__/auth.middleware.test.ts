import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { withAuth } from '../middleware/auth.js'

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: 'test-user', email: 'test@example.com' }),
  }),
}))

vi.mock('../repositories/allowedUser.repository.js', () => ({
  isEmailAllowed: vi.fn().mockResolvedValue(true),
}))

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

  it('returns a generic 500 response when a protected handler throws', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('database password leaked'))
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

    await wrapped({ headers: { authorization: 'Bearer token' } } as Request, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Error interno' })
  })
})
