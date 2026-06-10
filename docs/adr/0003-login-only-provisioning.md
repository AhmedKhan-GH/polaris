# ADR-0003: Login-only — no public self-registration

**Status:** Accepted
**Date:** 2026-06-09

## Context

Polaris is an internal tool: the people running the business are provisioned, they do not sign themselves up. The predecessor branch removed its public registration path late (`refactor(auth): remove public self-registration`) after carrying it as dead surface; the pre-rewrite `main` additionally fought a profile-bootstrap race (auto-create triggers added, fixed, then removed). A registration surface is attack surface plus bootstrap complexity, purchased for users who don't exist.

## Decision

The application exposes **no** registration: no `/register` route, no register action, ever, on this foundation. Accounts are provisioned out-of-band — Supabase Studio/CLI today, invite codes as the F9 feature (Settings + provisioning). `SUPABASE_SERVICE_ROLE_KEY` is deliberately **absent** from the validated env (`lib/env`) until F9 introduces an in-app consumer; only the E2E seeder reads it, directly from `process.env`.

## Consequences

- `profiles` rows are written only by privileged roles; the `authenticated` role's write grants are revoked, so a role self-escalation attempt fails loudly (`permission denied`), pinned by a live integration test.
- E2E seeds users via the GoTrue admin API in global setup.
- Adding any registration-shaped surface (including F9 invites) is a charter conversation touching D3, and reverses none of this ADR — invites are still provisioning, not self-registration.
