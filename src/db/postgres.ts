import postgres from 'postgres'
import { env } from '../config/env.js'

export const sql = postgres(env.DATABASE_URL, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  max_lifetime: 60 * 10,
  prepare: false,
})
