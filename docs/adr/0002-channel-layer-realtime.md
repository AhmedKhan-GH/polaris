# ADR-0002: Per-user realtime is gated at the channel layer, never by row RLS

**Status:** Accepted
**Date:** 2026-06-09

## Context

Hard-won fact (the "0021 scar", from migration `0021_fix_rls_for_realtime.sql` on the pre-rewrite `main`): Supabase Realtime's Postgres-Changes row authorizer does **not** reliably populate `auth.uid()` / `request.jwt.claims` when evaluating row policies, so ownership RLS (`created_by = auth.uid()`) on a streamed table silently filters out **all** events — delivery just goes dark, with no error.

This codebase is even more exposed: app-path tables use GUC-based policies (`current_setting('app.user_id')`), and those GUCs are set per-transaction by `withUserContext`. A separate Realtime process will *never* see them. Row-RLS-as-delivery-filter is therefore guaranteed-empty here, not merely unreliable.

## Decision

Per-user realtime delivery is enforced at the **channel layer**, the one place Realtime's identity context is reliable (channel subscription auth runs with the subscriber's JWT loaded):

1. **Routing:** an `AFTER INSERT/UPDATE/DELETE` trigger on the streamed table runs inside the normal transaction (full context available) and calls `realtime.broadcast_changes()` to two topics: `{domain}:{ownerUserId}` and `{domain}:all`.
2. **Gating:** an RLS policy on `realtime.messages` (where `auth.uid()` resolves) locks each subscriber to their own `{domain}:{auth.uid()}` topic; the `owner` role additionally reads `{domain}:all` (checked via the subscriber's own `profiles` row — which self-read RLS permits, so no recursion).

Row RLS on streamed tables remains — as data isolation for queries, never as delivery filtering. Feature teams instantiate the two SQL templates in `lib/realtime/templates/` (Charter D7); hand-rolling realtime authorization is a charter violation.

## Consequences

- Streamed tables keep only their `app_user` ownership policies; no coarse `authenticated` read policies are added for realtime's benefit.
- Every streamed domain ships exactly one trigger + one `realtime.messages` policy, both realtime-schema-guarded so the migration set still applies to vanilla-Postgres test containers.
- The channel-layer guarantee is pinned by live-Supabase tests (topic isolation: another user's private topic returns zero rows) that hard-fail in CI rather than skip.
