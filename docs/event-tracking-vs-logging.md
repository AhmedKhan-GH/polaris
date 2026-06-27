# Event Tracking vs. Operational Logging

Two separate systems that both record "something happened" — but for different audiences, with different lifecycles.

## Operational Logging (Pino)

**Audience:** Developers and ops during debugging/monitoring.

**Purpose:** Answer "what went wrong?" and "how is the system behaving?"

**Examples:**
- `WARN: Supabase signIn returned AuthApiError for user@example.com`
- `ERROR: Database connection timeout after 5000ms`
- `INFO: Request POST /api/orders completed in 120ms`
- `DEBUG: Middleware redirected unauthenticated user to /login`

**Characteristics:**
- Noisy — logs every request, error, retry
- Ephemeral — rotated/deleted after days or weeks
- Unstructured or semi-structured (JSON lines)
- Not queried for business insights
- Contains system internals (stack traces, connection strings, timing)

## Event Tracking (Custom Events Table or PostHog)

**Audience:** Product owners, analysts, and business stakeholders.

**Purpose:** Answer "what are users doing?" and "is the product working?"

**Examples:**
- `user.logged_in` — who logged in, when, from where
- `order.created` — who created it, what type, what value
- `order.status_changed` — from what to what, by whom
- `invite.sent` — who invited whom, what role

**Characteristics:**
- Selective — only records meaningful user actions
- Permanent — kept indefinitely for trend analysis
- Structured — consistent schema (actor, action, resource, metadata, timestamp)
- Queried for business insights (funnels, retention, usage patterns)
- Contains no system internals — only business-level facts

## The Login Example

When a user logs in, both systems fire — recording different things:

| | Operational Log (Pino) | Event Track |
|---|---|---|
| **What** | `POST /login 302 240ms` | `user.logged_in` |
| **Detail** | Status code, response time, redirect target, Supabase latency | User ID, timestamp, login method |
| **On failure** | `WARN: AuthApiError invalid_credentials email=...` | `user.login_failed` (actor=anonymous, metadata={email}) |
| **Retention** | 7-30 days | Forever |
| **Who reads it** | Developer investigating a bug | PM asking "how many logins this week?" |

## PostHog vs. Custom Events Table

| | Custom Events Table | PostHog |
|---|---|---|
| **Where data lives** | Your Postgres database | PostHog Cloud or self-hosted container |
| **Dashboards** | You build them (SQL queries, or a UI later) | Built-in (funnels, trends, retention charts) |
| **Session replay** | No | Yes |
| **Feature flags** | No | Yes |
| **Complexity** | One table + one helper function | External service + JS SDK |
| **Cost** | Free (it's your database) | Free tier (1M events/month), then paid |
| **Best for** | Internal tools with simple analytics needs | User-facing products needing product-market fit insights |

## Recommendation for Polaris

Use both, for their intended purpose:

- **Pino** for operational logging — errors, request timing, debugging. Already planned in Feature 2.
- **Custom events table** for event tracking — user actions, audit trail, business analytics. Already planned in Feature 2.
- **PostHog** — revisit if/when Polaris becomes external-facing or you need dashboards without building them.
