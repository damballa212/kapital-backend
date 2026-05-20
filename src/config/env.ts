import { z } from 'zod'

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  EVOLUTION_API_URL: z.string().url(),
  EVOLUTION_API_KEY: z.string().min(1),
  EVOLUTION_INSTANCE: z.string().min(1),
  // JSON del service account de Firebase Admin (requerido en VPS, omitir en GCP/emulador)
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
})

export const env = EnvSchema.parse(process.env)
