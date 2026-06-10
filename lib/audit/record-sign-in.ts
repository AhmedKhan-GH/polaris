import { db } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { signInLog } from '@/lib/db/schema';

/**
 * Record a SUCCESSFUL sign-in as a durable audit fact in `sign_in_log`.
 *
 * Best-effort by design: an audit-write outage must NEVER block a login that
 * has already succeeded (Charter D5). So any failure is swallowed — logged at
 * `warn` for an operator, then the call returns normally. The caller is on the
 * post-authentication happy path and must not see an exception from here.
 */
export async function recordSignIn(entry: {
  userId: string | null;
  email: string;
}): Promise<void> {
  try {
    await db.insert(signInLog).values({
      userId: entry.userId,
      email: entry.email,
    });
  } catch (err) {
    logger.warn({ err, email: entry.email }, 'failed to write sign_in_log');
  }
}
