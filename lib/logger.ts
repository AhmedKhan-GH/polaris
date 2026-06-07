import pino from 'pino'

// Operational/diagnostic logging (ephemeral) — errors, denials, failures.
// Business/audit facts go in the database (e.g. sign_in_log), not here.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV !== 'production'
    ? { transport: { target: 'pino-pretty' } }
    : {}),
})
