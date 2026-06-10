import { getServerSupabase } from '@/lib/supabase/server';

/**
 * The session user resolved from the request's Supabase auth token.
 *
 * `roles` is an ARRAY even though a profile carries exactly one DB role: the
 * single role is wrapped so this shape matches the `roles: string[]` contract
 * shared by CASL (ability building) and the Postgres GUC (`app.user_roles`,
 * a JSON array). Keeping one representation end-to-end avoids per-layer reshaping.
 */
export type SessionUser = { userId: string; email: string | null; roles: string[] };

/**
 * Resolve the current request's authenticated user — the ONLY identity resolver
 * in the codebase. Returns `null` when there is no authenticated user.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await getServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Authenticated client → the `profiles_select_self` RLS policy applies, so a
  // user can only ever read its OWN role here.
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return {
    userId: user.id,
    email: user.email ?? null,
    roles: data?.role ? [data.role] : [],
  };
}
