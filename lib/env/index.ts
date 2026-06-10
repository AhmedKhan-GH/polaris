import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * Validated, typed environment access. Fails closed at import time: an invalid
 * value (e.g. an out-of-range `LOG_LEVEL`) throws before any code can read it.
 * Set `SKIP_ENV_VALIDATION` to bypass validation (e.g. for lint/typecheck in CI
 * where real values are absent).
 */
export const env = createEnv({
  server: {
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .optional(),
  },
  client: {},
  runtimeEnv: {
    LOG_LEVEL: process.env.LOG_LEVEL,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
