// E2E runs against the live local Supabase (seeded idempotently in global-setup),
// so there is no throwaway container to tear down. Kept as an explicit no-op hook
// so playwright.config's globalTeardown reference stays valid.
export default async function globalTeardown() {
  // intentionally empty
}
