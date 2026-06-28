# Time-based UI Preferences — Design

> **Status:** proposed (2026-06-28). Per-account **timezone + 12/24h clock**, formatted
> server-side onto every rendered timestamp. Replaces the localStorage version stranded
> on `archive/feature/order-line-items`. It is a **foundation/identity concern, not a
> business feature** (Iron Rule 2) — so it **requires an ADR** (Rule 9 / D11) in the same PR.

## What it is

A user's display preferences for how times are shown — their IANA `timezone` and whether
the clock is `12h` or `24h` — stored **per account** and applied to every timestamp the app
renders (orders, notes, activity). Two controls in the shell top bar, one small foundation
table, one pure formatter.

## Why foundation, not a feature

`timezone`/`hour12` must be read by *every* feature that renders a timestamp. **Iron Rule 2**
forbids features importing each other, so an `app/_features/preferences/` feature would be
unreachable by `orders`/`notes`/`activity`. The preference is cross-cutting per-user state —
the same shape as identity — so it rides in **foundation, next to D3 (Identity)**, where
every feature may read it. (The localStorage version lived in a feature folder only because
the old lineage had no such rule.)

## Architecture (by domain)

- **D2 — storage:** `user_preferences` foundation slice — `user_id uuid` (PK, FK to the auth
  user), `timezone text not null`, `hour12 boolean not null`, `updated_at timestamptz`.
  **Self-write GUC RLS**: `user_id = app.user_id` for SELECT *and* INSERT/UPDATE. Grants to
  `app_user`. Not on `profiles` (D3 write-locks it against role escalation; a separate table
  is self-writable safely).
- **D3 — read:** `getPreferences()` foundation fn — reads the caller's row via
  `withUserContext`, returns `{ timezone, hour12 }`, defaulting to `{ 'UTC', false }` (24h)
  when no row exists. A sibling to `getSessionUser`, not a bloat of it.
- **foundation — formatter:** `lib/datetime.ts` — pure
  `formatTimestamp(ms, timezone, hour12) => string` (`Intl.DateTimeFormat`, `hourCycle`,
  `formatToParts`). Ported from `order-line-items`' `lib/domain/order.ts`. Importable by
  every feature.
- **D8 — controls + write:** `TimezoneSelector` + `Hour12Toggle` in the shell top bar;
  `setPreferencesAction(input)` = `withPermission('update','Preferences')` → Zod (valid IANA
  zone + boolean) → `withUserContext` → upsert → `revalidatePath('/', 'layout')`.
  Pending-state UI (`useTransition`/`isPending`) — the house pattern, **not** optimistic.
- **D4 — authz:** a `Preferences` subject; any authenticated user reads/updates **their own**
  (self-scoped, mirrors the RLS).
- **D9 — tests:** unit (formatter: zone, a DST boundary, h12/h23, the default), integration
  (RLS under `app_user`: own-row read+write only, another user's invisible), E2E (toggle →
  every view re-renders in the new zone; persists across logout/login).

## Build slices (TDD, red → green → commit)

- **P0 — ADR**: record "preferences = identity-adjacent foundation concern; `user_preferences`
  table; self-write RLS; formatter in `lib/`." (`docs/adr/`.)
- **P1 — formatter**: `lib/datetime.ts` + unit tests **first** (zone correctness, a DST
  boundary, h12 vs h23, the UTC/24h default). Pure, no deps.
- **P2 — table + RLS**: `user_preferences` slice + migration; integration test under
  `app_user` (user reads/writes only their own row; another user's is invisible).
- **P3 — `getPreferences()`**: read + defaults; integration test.
- **P4 — action + controls**: `setPreferencesAction` (guard → Zod → context → upsert →
  revalidate) + the two shell controls with pending state; unit + E2E.
- **P5 — apply**: swap orders/notes/activity views to format `created_at` via
  `getPreferences()` + `lib/datetime.ts` server-side; remove the old UTC-placeholder
  hydration code. E2E: set zone → all views reflect; survives logout/login (DB, not device).

## Decisions

1. **Foundation/identity, not a feature** — forced by Iron Rule 2 (cross-cutting read).
   Formalized in P0's ADR.
2. **Own table, not `profiles`** — profiles is write-locked (D3).
3. **Server-side formatting via the session read** — eliminates the SSR/hydration flicker
   (the `mounted` gate, the UTC placeholder) entirely.
4. **Default `UTC` + 24h** until set. Later option: capture the browser zone on first
   sign-in and seed the row.
5. **No realtime** — a personal preference, not shared state.
6. **Pending UI, not optimistic** — matches every other write in the codebase (there is no
   `useOptimistic` anywhere).
