import pino from 'pino';

import { env } from '@/lib/env';

/**
 * Operational logger. This is for diagnostic events ONLY — errors, authorization
 * denials, request failures, and similar signals an operator needs to see.
 *
 * Business and audit FACTS (a profile was created, an order changed state, who
 * did what) belong in the database, never here. Logs are best-effort, lossy, and
 * disposable; facts must be durable, queryable, and tied to the data they
 * describe. Do not reach for the logger when you mean to record something true.
 */
export const logger: pino.Logger = pino({
  level: env.LOG_LEVEL ?? 'info',
  // Human-readable pretty-printing in development only. In production we emit
  // raw newline-delimited JSON to stdout with no transport, so the platform's
  // log collector can ingest it without a worker thread in the hot path.
  ...(process.env.NODE_ENV !== 'production'
    ? { transport: { target: 'pino-pretty' } }
    : {}),
});
