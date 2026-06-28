# ADR-0009: Time-based UI preferences are a foundation concern

**Status:** Accepted
**Date:** 2026-06-28

## Context

The app needs per-user display preferences — an IANA `timezone` and a 12/24h clock — applied
to every rendered timestamp. A prior implementation (on the archived `order-line-items`
lineage) stored them in `localStorage` and lived in `app/_features/preferences/`.

Two facts force a different placement in clean-rewrite-2:

1. **Timestamps render in every feature** — orders, notes, activity. The preference must be
   readable by all of them.
2. **Iron Rule 2 forbids features importing each other.** A preferences *feature*
   (`app/_features/preferences/`) would therefore be unreachable by `orders`/`notes`/
   `activity` — useless for a value they all must read.

Independently, `localStorage` sits outside **D2**: the persistence model is the database,
RLS-scoped. A device-bound store cannot follow the account across devices and cannot be read
server-side — which the server-first architecture wants, so it can format timestamps
correctly on the first paint instead of hydrating UTC placeholders into place.

## Decision

Time-based UI preferences are an **identity-adjacent foundation concern**, not a business
feature.

- **Storage:** a `user_preferences` foundation table (`user_id` PK/FK, `timezone`, `hour12`,
  `updated_at`) with **self-write GUC RLS** (`user_id = app.user_id` for SELECT *and*
  INSERT/UPDATE), grants to `app_user`. **Not** on `profiles` — D3 write-locks that against
  role escalation; a separate table is self-writable safely.
- **Read:** a `getPreferences()` foundation function — a sibling to D3's `getSessionUser`,
  returning `{ timezone, hour12 }`, defaulting to `UTC` + 24h when no row exists.
- **Formatting:** a pure `lib/datetime.ts` formatter, importable by every feature.
- **Write surface:** the `setPreferences` action and the two controls (`TimezoneSelector`,
  `Hour12Toggle`) live in the D8 shell.

## Consequences

- **Simpler:** the server reads the preference and formats timestamps correctly on first
  paint — the `localStorage` version's UTC-placeholder + `mounted`-gate hydration dance
  disappears. Preferences follow the account across devices.
- **Charter change:** this extends foundation (D3-adjacent) and touches `lib/**`, so it is a
  charter conversation (Rule 9), recorded by this ADR. Features still never import each other
  — they read preferences only through foundation, so the import-boundary test keeps passing.
- **Cost:** a write is a DB round-trip (the house pattern: server action → `revalidatePath`
  → pending UI), not the `localStorage` version's instant write. Accepted — it matches every
  other mutation in the codebase (there is no optimistic UI anywhere).
- **To revisit:** this ADR governs *cross-cutting* display preferences only. A preference
  that is genuinely feature-specific (read by one feature) could live in that feature; it
  would not be bound by this decision.
