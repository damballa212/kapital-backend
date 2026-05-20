import postgres from 'postgres'
import { env } from '../config/env.js'

export const sql = postgres(env.DATABASE_URL, {
  ssl: 'require',
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
})
