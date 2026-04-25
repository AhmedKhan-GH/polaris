import { config } from 'dotenv'
import { z } from 'zod'

// Server-only: pull .env.local into process.env. Next.js auto-loads
// before any module executes, so this is a no-op there. tsx scripts
// (npm run sim:other-user, db:seed) don't auto-load, so this is the
// only place that gets them to validate. Guarded by a window check
// so the client bundle skips dotenv (it has no fs).
if (typeof window === 'undefined') {
  config({ path: '.env.local' })
}

// Client-safe env (NEXT_PUBLIC_* only). Validated on both server and client.
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
})

export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
})

// Server-only env. Parsed eagerly on the server, null on the client.
const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
})

type ServerEnv = z.infer<typeof serverSchema>

const isServer = typeof window === 'undefined'

export const serverEnv: ServerEnv | null = isServer
  ? serverSchema.parse({
      DATABASE_URL: process.env.DATABASE_URL,
      LOG_LEVEL: process.env.LOG_LEVEL,
    })
  : null
