import { z } from 'zod'

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
