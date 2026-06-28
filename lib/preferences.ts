import { eq } from 'drizzle-orm';

import { getSessionUser } from '@/lib/auth/session';
import { userPreferences } from '@/lib/db/schema/preferences';
import { withUserContext } from '@/lib/db/with-user-context';

export type Preferences = { timezone: string; hour12: boolean };

/**
 * The fallback when a user has no row yet (or no session at all): UTC + 24h.
 * Mirrors the table's column defaults (ADR-0009).
 */
export const DEFAULT_PREFERENCES: Preferences = { timezone: 'UTC', hour12: false };

/**
 * The current user's display preferences (ADR-0009). Resolves the session, reads
 * the caller's `user_preferences` row under their own identity (RLS scopes the
 * query to self), and falls back to UTC + 24h when there is no session or no row.
 *
 * A pure read: every server view formats timestamps with this (via
 * lib/datetime.ts). It never writes — that is the D8 `setPreferences` action.
 * Foundation, so any feature may call it without crossing a feature boundary.
 */
export async function getPreferences(): Promise<Preferences> {
  const user = await getSessionUser();
  if (!user) return DEFAULT_PREFERENCES;

  const [row] = await withUserContext(user, (tx) =>
    tx
      .select({
        timezone: userPreferences.timezone,
        hour12: userPreferences.hour12,
      })
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.userId))
      .limit(1),
  );

  return row ?? DEFAULT_PREFERENCES;
}
