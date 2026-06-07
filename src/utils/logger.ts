import { Logtail } from '@logtail/node'

const token = process.env.BETTERSTACK_TOKEN
const endpoint = process.env.BETTERSTACK_HOST

const logtail = token ? new Logtail(token, { endpoint }) : null

type Level = 'info' | 'warn' | 'error'

function log(level: Level, message: string, context?: Record<string, unknown>) {
  const args = context ? [message, context] : [message]
  console[level](...args)
  if (logtail) {
    logtail[level](message, context ?? {}).catch(() => undefined)
  }
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => log('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => log('error', message, context),
}
