# Shelved Features

Features intentionally deferred. Revisit when core flows are stable.

## Product price changelog (list-price history)

- [ ] Record each change to `products.price_cents` over time (who, when, old → new)
- [ ] Surface the price-delta history on the Products page
- [ ] Decide retention/granularity (every edit vs. daily snapshot)

**Why shelved:** Purely a Products audit/reporting feature, fully decoupled from
orders. The order line already freezes `list_price_cents` at add time, so
order-time pricing is correct with or without this changelog — it adds visibility
into catalog drift, nothing more. No downstream feature depends on it.

**Revisit when:** The orders surface (inline-editable lines + views) is stable and
there's a concrete need to audit catalog price movement.

## OAuth (Google / GitHub login)

- [ ] Google OAuth provider setup in Supabase
- [ ] GitHub OAuth provider setup in Supabase
- [ ] OAuth callback route (`/auth/callback`)
- [ ] "Sign in with Google" button on login page
- [ ] "Sign in with GitHub" button on login page
- [ ] Link OAuth accounts to existing email accounts
- [ ] E2E tests for OAuth flows

**Why shelved:** Local auth (email/password) must be solid first. OAuth adds provider config complexity and two auth paths to test. Doesn't unlock any downstream feature work.

**Revisit when:** Registration + login + permissions are stable and deployed.
