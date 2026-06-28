# Security Checklist

> **Reference** — the generic web-security how-to: the Server-Actions-vs-API-Routes decision guide, the per-change checklists, and the pre-deploy list. The *Polaris-specific* security model — the 14 layers, RLS/CASL, the `app_user` GUC, the diagrams — is [`SECURITY-HANDBOOK.md`](../../SECURITY-HANDBOOK.md); this is the underlying practice it assumes.

> **If every rule in this document is followed, you are secure for your current stage.** This is the complete set. Nothing is implicit, nothing is "also consider." When in doubt, re-read this document and do exactly what it says.

The document has four sections:

1. **Always-on rules** — apply to every line of code you write
2. **When adding something new** — gated checklists by type of change
3. **Before you deploy publicly** — must-haves before the URL is shared
4. **Handled for you** — things you should *not* spend time on

Reference material (SOP, CSRF, CORS, CSP) lives at the end.

---

## 1. Always-on rules

Every single time you write code:

- [ ] **Mutations go through Server Actions.** Never hand-write an API route for a write unless you have a specific reason. Server Actions carry automatic CSRF protection; API routes do not.
- [ ] **Validate inputs at every server boundary** with Zod or Valibot. Never trust what the client sends, even if it's your own frontend.
- [ ] **Use Drizzle's query builder.** Never concatenate SQL with template literals or `+`. `eq(orders.id, id)`, not `` `WHERE id = ${id}` ``.
- [ ] **Project domain data through a mapper before it crosses into client code.** Your `toOrder` is the model. No raw DB rows in client components. There is a unit test (`tests/orderMapper.test.ts`) pinning this rule; run it.
- [ ] **Never log PII or secrets.** IDs and `orderNumber`s are fine. Addresses, phones, emails, tokens, keys, and payment details are not. When customer fields arrive, add a Pino `redact` config.
- [ ] **Structure error logs.** `log.error({ err, ...context }, 'message')`, never `log.error(err)` or `log.error(err.toString())`. Raw error objects can contain connection strings, query params, tokens.
- [ ] **Never commit `.env*` files.** `.gitignore` already covers them. Don't override with `-f`. If a secret accidentally lands in a commit, rotate it immediately — removing it from history is not enough.
- [ ] **Never commit secrets in code.** API keys, DB passwords, private URLs. Read the diff before `git commit`.

---

## 2. When adding something new

Only check items relevant to the change you're making.

### Adding a new API route (`app/api/*/route.ts`)

- [ ] Decide if this really needs to be an API route — most things are better as Server Actions.
- [ ] Validate the request body with Zod.
- [ ] Check the `Origin` header against an allowlist, **or** require a CSRF token, **or** require a shared-secret header (for webhooks).
- [ ] Decide the CORS policy explicitly. Default: no CORS headers = same-origin only.
- [ ] Never pair `Access-Control-Allow-Origin: *` with `Allow-Credentials: true`.
- [ ] Rate limit if the route mutates state.

### Adding a new Server Action

- [ ] Validate any arguments with Zod.
- [ ] Wrap the body in `try/catch`, log errors structurally, re-throw.
- [ ] Return only the fields the client needs.
- [ ] Never return raw database rows.

### Adding a new env variable

- [ ] Public client-readable value? Prefix with `NEXT_PUBLIC_`.
- [ ] Secret? No prefix. Available to server code only.
- [ ] Add it to your host's env var panel, not to a committed file.
- [ ] Document its purpose in `.env.example` (never the real value).

### Adding a new cookie

- [ ] `Secure: true` (HTTPS only)
- [ ] `HttpOnly: true` (no JS access)
- [ ] `SameSite: 'lax'` unless you have a documented reason for `'strict'` or `'none'`
- [ ] `Path`, `MaxAge`/`Expires` set appropriately
- [ ] Never store anything that the browser doesn't need to read

### Adding a new field on a domain object

- [ ] Decide at this moment: should it cross to the UI? Yes → add to the mapper. No → it stays server-side, never added to the mapper.
- [ ] If it might carry PII, add to the Pino `redact` list simultaneously.

### Adding a new external integration (Supabase, Stripe, email, etc.)

- [ ] Credentials in env vars, never in code.
- [ ] Use their official SDK — don't hand-roll HTTP.
- [ ] Allowlist their webhook source if they call back into your app.
- [ ] Review what data you're sending them (log one request in dev to see).

---

## 3. Before you deploy publicly

Do every one of these before sharing the URL with anyone outside the team.

### Access control

- [ ] **Add a gate.** No auth? Use Vercel password-protect, or an HTTP Basic middleware reading from an env var. Public write endpoints without auth are a DoS waiting to happen.
- [ ] **Plan for real auth** (Auth.js, Clerk, Supabase Auth) on the roadmap before real users arrive.

### Infrastructure

- [ ] **HTTPS everywhere.** The host (Vercel/Fly/Railway) handles this automatically. Verify by loading the URL and confirming the lock icon. No auth over HTTP ever.
- [ ] **Env vars on the host.** `DATABASE_URL`, `LOG_LEVEL=info`, any service secrets. Never in `.env.local` on the server.
- [ ] **Migrations in the deploy pipeline.** Build command should run `drizzle-kit migrate && next build` so production schema always matches code.
- [ ] **Database role is least-privileged.** The app's DB user should have `SELECT` / `INSERT` / `UPDATE` / `DELETE` on its tables, no `DROP`, `TRUNCATE`, `CREATE ROLE`. Review Supabase role permissions.

### Runtime defences

- [ ] **Rate limit mutations.** Even pre-auth — anyone can spam `createOrderAction`. Upstash Redis + a per-IP token bucket is the 10-minute fix.
- [ ] **Set a Content-Security-Policy** via middleware using nonces (see CSP section below). Production apps without a CSP are one XSS away from catastrophe.
- [ ] **Set sensible default headers** via `next.config.ts`:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` restricting camera/mic/geolocation unless used
- [ ] **Error boundaries do not render error messages to users.** Next.js's default `error.tsx` is acceptable in prod. Don't echo `err.message` in custom boundaries.
- [ ] **`LOG_LEVEL=info` in prod** so `log.debug(...)` query internals stay out of your log aggregator.

### Verification

- [ ] `NODE_ENV=production npm run build && npm start` locally before first deploy. Catches missing env vars and SSR-only bugs.
- [ ] `npm test` passing on the commit you're deploying.
- [ ] Check the deployed URL with DevTools open — confirm no secrets, no UUIDs, no stack traces in the rendered DOM.

---

## 4. Handled for you — do not spend time on

Things Next.js, Drizzle, the browser, or your host cover automatically. Ignoring them is correct; re-implementing them is wasted effort and often less safe.

- **CSRF on Server Actions** — automatic per-action tokens, bound to the render.
- **SQL escaping** — Drizzle parameterizes every `eq(...)` and `.values(...)`.
- **Same-Origin Policy enforcement** — the browser does this for you.
- **SameSite=Lax cookies by default** — modern browser default; explicit `SameSite` value only needed when you want to deviate.
- **CORS for same-origin fetches** — no configuration needed for within-app calls.
- **`allowedDevOrigins`** — dev-only; ignored in production builds.
- **HTTPS termination** — the host handles it.
- **DNS rebinding protection in dev** — Next 16 guards dev endpoints by default.

---

## 5. Server Actions vs API Routes

The single most common security-adjacent decision you'll make: should this go in a Server Action or an API route? The rule:

> **Ask: "Is anything other than my own frontend ever going to call this?"**
> - No → **Server Action.** Default choice.
> - Yes → **API Route.** Explicitly designed for the external caller.

If you catch yourself writing an API route *just* so your own UI can call it, you probably want a Server Action instead.

### Why this matters for security

Server Actions give you protections automatically. API routes make you implement every one yourself:

| | Server Action | API Route |
|---|---|---|
| CSRF protection | **automatic** (per-action token bound to the render) | **you write it** (Origin check, CSRF token, or shared-secret header) |
| Body parsing / validation | typed args passed in | manual `req.json()` / `formData()` + manual validation |
| Method enforcement | POST-only, enforced | you pick, you enforce |
| Callers | only your app's rendered pages | **anyone, anywhere** (curl, another app, a webhook sender) |
| CORS | not applicable | you configure per route if cross-origin callers need in |
| Response construction | `return` typed data | build a `Response` with headers, status, body |
| Progressive enhancement | `<form action={fn}>` works without JS | requires JS to `fetch` |

### When to reach for each

**Server Actions (default for in-app work):**
- Form submissions
- Button-driven mutations in Client Components
- Any state change driven by your own UI

**API Routes (only when you genuinely need HTTP):**
- **Webhooks** (Stripe, Supabase, carrier callbacks) — external systems POST to you
- **Third-party integrations** that need a URL
- **Mobile / native clients** hitting your backend
- **Cron jobs** hit via HTTP
- **File uploads / streaming / SSE / WebSocket upgrades**
- **Public APIs** consumed by partners outside your app

### What an API route requires that a Server Action doesn't

Every `POST` route handler in your codebase needs, at minimum:

```ts
// app/api/orders/route.ts
import { z } from 'zod'

const schema = z.object({ /* ... */ })

export async function POST(req: Request) {
  // 1. Cross-site protection — pick one:
  //    - Origin allowlist
  //    - CSRF token
  //    - Shared-secret header (for webhooks)
  const origin = req.headers.get('origin')
  if (origin && origin !== 'https://polaris.app') {
    return new Response('forbidden', { status: 403 })
  }

  // 2. Manual body parse + validation
  let body: unknown
  try { body = await req.json() }
  catch { return new Response('bad json', { status: 400 }) }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return new Response('invalid', { status: 400 })

  // 3. Do the work

  // 4. Build the response explicitly
  return Response.json({ ok: true }, { status: 201 })
}
```

Every commented step is something Server Actions do automatically. The §2 "Adding a new API route" checklist exists specifically to make sure none of these steps are forgotten.

## 6. Reference: core concepts

One-line definitions for quick recall. Full explanations are available in the Next.js docs and MDN — these should be enough to jog memory.

**Same-Origin Policy (SOP).** Browsers forbid JS from reading responses across origins (scheme+host+port) unless the server opts in. The foundation of everything else.

**CSRF (Cross-Site Request Forgery).** A malicious site makes the user's browser submit a request to your site using the user's cookies. Defence: SameSite cookies + per-request tokens. Server Actions do both automatically.

**CORS (Cross-Origin Resource Sharing).** The server's mechanism to grant cross-origin read access. Opt-in, not a restriction. You set `Access-Control-Allow-Origin` headers on API routes that legitimately need to be called from another origin. Never use `*` with credentials.

**CSP (Content-Security-Policy).** An HTTP header telling the browser which resources your page is allowed to load. Defence-in-depth against XSS — even if an attacker injects `<script>`, the browser refuses to run it unless the source is allow-listed. In Next.js, use nonce-based CSP via middleware. See [Next.js's official CSP guide](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy).

**`allowedDevOrigins`.** Dev-only allowlist protecting HMR / error-overlay / source-chunk endpoints from DNS-rebinding and cross-origin attacks. Production builds ignore it; never configure for prod.

**Dev vs prod threat model.** Dev exposes privileged endpoints (HMR, source maps, error overlay) that prod does not. Prod has server-rendered HTML, compiled JS, server actions with automatic CSRF, and your configured API routes — nothing else. The dev-specific flags (`allowedDevOrigins`) are irrelevant in prod; the prod checklist in §3 is what matters.

---

## TL;DR

Follow §1 while coding. Follow §2 when adding features. Run §3 before any public URL. Ignore §4 entirely. Apply §5 to decide between Server Action and API Route on every new mutation. Refer to §6 only when something unfamiliar comes up.

That is the full security posture. There is nothing to doubt and nothing to add beyond this list.
