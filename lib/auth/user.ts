/**
 * UI-facing shape of an authenticated user, deliberately decoupled from any
 * auth provider. Components and presentational layers depend on this — never on
 * a Supabase `User` — so the provider can change without touching the UI. The
 * server-side identity resolver (`getSessionUser`) is the boundary that maps
 * provider data onto application types like this one.
 *
 * All fields are optional and nullable to mirror the lowest common denominator
 * across providers and unauthenticated render paths.
 */
export type AuthUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};
