import type { Request, Response } from 'express'

export async function handleAuthMe(req: Request, res: Response): Promise<void> {
  const auth = res.locals.auth
  res.json({
    uid:     auth.uid,
    email:   auth.email   ?? '',
    name:    auth.name    ?? '',
    picture: auth.picture ?? '',
  })
}
