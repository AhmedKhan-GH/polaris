'use server';

import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { userPreferences } from '@/lib/db/schema/preferences';
import { withUserContext } from '@/lib/db/with-user-context';
import { withPermission } from '@/lib/permissions/guard';
import { createRateLimiter, withRateLimit } from '@/lib/rate-limit';

/**
 * Write budget for preference updates, OWNED by the shell surface (Charter D6):
 * 30 writes / 60s per acting user — generous for a human nudging a control, tight
 * against a runaway client.
 */
const preferencesWriteLimiter = createRateLimiter({ points: 30, duration: 60 });

/** A valid IANA zone is one `Intl.DateTimeFormat` accepts without throwing. */
function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The full preferences payload, validated at the action boundary. The controls
 * always send BOTH fields (each carries the current value of the other), so the
 * upsert writes a complete row; an unknown timezone is rejected before any DB
 * access.
 */
const preferencesSchema = z.object({
  timezone: z.string().refine(isValidTimeZone, 'Unknown timezone'),
  hour12: z.boolean(),
  // Optional: the time controls omit it (leaving theme untouched); the theme
  // control sends it. Validated to the same union the column is narrowed to.
  theme: z.enum(['light', 'dark']).optional(),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;

/**
 * Upsert the acting user's display preferences (ADR-0009).
 *
 * Pipeline order is CONTRACTUAL: guard → limiter → validate → context, then
 * revalidate. The guard yields the identity the write runs as; the
 * `user_preferences` RLS WITH CHECK independently forbids writing anyone else's
 * row. `revalidatePath('/', 'layout')` re-renders the whole authed shell so every
 * timestamp re-formats in the new zone/clock — never on a denied or invalid call.
 */
export async function setPreferences(input: PreferencesInput): Promise<void> {
  await withPermission('update', 'Preferences', (ctx) =>
    withRateLimit(
      preferencesWriteLimiter,
      `preferences:update:${ctx.userId}`,
      async () => {
        const { timezone, hour12, theme } = preferencesSchema.parse(input);
        await withUserContext(ctx, (tx) =>
          tx
            .insert(userPreferences)
            .values({ userId: ctx.userId, timezone, hour12, ...(theme ? { theme } : {}) })
            .onConflictDoUpdate({
              target: userPreferences.userId,
              set: { timezone, hour12, updatedAt: sql`now()`, ...(theme ? { theme } : {}) },
            }),
        );
      },
    ),
  );

  revalidatePath('/', 'layout');
}
