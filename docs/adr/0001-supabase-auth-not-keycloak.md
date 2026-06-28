# ADR-0001: Supabase Auth, not Keycloak

**Status:** Accepted
**Date:** 2026-06-09 (decision made on `clean-rewrite`; carried into `clean-rewrite-2` at construction)

## Context

The predecessor branch (`clean-rewrite`) migrated identity to self-hosted Keycloak 26.1 with Auth.js/NextAuth OIDC, and planned to migrate realtime to Centrifugo. The capabilities that justify Keycloak — multi-app SSO, enterprise identity federation, UMA Authorization Services, IdP-level multi-tenancy — were none of them used or on the roadmap. The most Polaris will ever need is *users and organizations*, which is application-level multi-tenancy in our own Postgres with RLS (the F12/IAM work), not IdP tenancy.

The observed price of the option: Keycloak-shaped JWTs broke Supabase Realtime entirely (forcing the planned Centrifugo lift), two extra Docker containers, a two-step end-session logout, bespoke Keycloak claim validation at every boundary, CI image-pull flakes — and roughly 57 commits of adoption-then-removal churn (~28 in, ~29 out).

## Decision

Supabase Auth (GoTrue via `@supabase/ssr`) is the identity provider, permanently for this codebase generation. It supplies everything actually used — email/password login, brute-force protection, a stable user id joined to `profiles.role` as the role source — and makes Supabase Realtime work natively, deleting the Centrifugo line item outright.

## Consequences

- Identity resolution has exactly one path: `getSessionUser()` over the cookie-bound Supabase client (Charter D3).
- Realtime authorization is reconstructed at the channel layer (ADR-0002), which only works against Supabase-shaped JWTs — Supabase Auth and Supabase Realtime are a package deal.
- No public registration surface (ADR-0003).
- Revisit trigger: a second first-party application needing SSO, or a real enterprise-federation requirement. Until one exists, any IdP migration proposal must account for the full knock-on cost recorded here.
- Prior art, if ever revisited: the one Keycloak capability with a concrete Polaris design was **Authorization Services as a runtime policy decision point** — to let non-developers change permissions without a redeploy, Keycloak would return grants (`response_mode=permissions`) that map into CASL. Captured here because that design lived only in the now-removed `keycloak-authz-services` spec; today the same need is served statically by CASL + Postgres RLS.
