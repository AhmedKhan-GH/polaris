# Polaris — Foundation & the IAM Project (single source for vulturu + penut)

This is the **one document** you need. **Part I** is the foundation every Polaris
feature is built on (the security model, conventions, and the exact patterns you'll
copy). **Part II** is your project: organizations, membership, and org-scoped orders.
Read Part I once, keep it open, and check your work against its §5 checklist on every
PR. The live task list is GitHub **Project "IAM Foundation"** + epic issue (the 14
issues `IAM 1…14`). For the **full security model** — every layer, the mechanics
diagrams, the threat model, and the control→file map — see **`SECURITY-HANDBOOK.md`**
(this brief's Part I is its condensed form).

> You start at the **head of the Keycloak-removal merge into `clean-rewrite`**: the app
> runs on **Supabase Auth**, with `profiles`, a bare `orders` table, `withUserContext`,
> CASL, and a non-superuser `app_user` already in place. You extend all of these.

---

# PART I — THE FOUNDATION (what "secure" means here)

A foundation is "secure" because **every layer is addressed** and a few principles hold
**across all of them**. You don't invent security here — you plug into a model that
already exists. Your job is to extend it without poking a hole in it.

## 1. The principles (the spine)

| # | Principle | What it means for you |
|---|---|---|
| 1 | **Fail closed** — deny by default | A missing/invalid identity never reaches the DB. `withPermission` throws without a session. Your `withOrgContext` throws for a non-member. |
| 2 | **Defense in depth** — ≥2 layers | **CASL *and* RLS.** App-layer guard *and* DB-layer row scoping. A bug in one is caught by the other. This redundancy is the deliverable. |
| 3 | **Validate at every trust boundary** | Zod `.parse` on inputs and identity (UUIDs, role enums) **before** the work. |
| 4 | **Least privilege** | The app connects as the non-superuser **`app_user`** (no `BYPASSRLS`, not a table owner). Migrations use a separate privileged role. **Never change this.** |
| 5 | **Tests mirror prod** | RLS is tested **under `app_user`** on a real Postgres (the harness). A superuser test would bypass RLS and hide bugs. |
| 6 | **Test-first (TDD)** | Failing test first → watch it fail → minimal code → watch it pass → commit. No production code without a red test that demanded it. |
| 7 | **Build-vs-buy** | Libraries for hard problems (Zod, CASL, Drizzle, `@supabase/ssr`); hand-rolled only for thin glue (guards/wrappers). |
| 8 | **Security rides with features** | Gate the surface as it lands — don't pre-build authz for things that don't exist yet, and never ship a surface ungated. |

## 2. The 14-layer model (the ones you touch in **bold**)

Authentication (Supabase Auth) · Session integrity (`@supabase/ssr` JWT cookies) ·
**Authorization (CASL `withPermission`)** · **Data isolation (RLS)** ·
**Least-privilege access (`app_user`)** · **Input validation (Zod)** · Config/secrets
(t3-env) · Transport/headers · Abuse resistance (rate limiting) · Observability
(Pino + `sign_in_log`) · Supply chain · Resilience · **Verification (TDD + the RLS
harness)** · **Structure (feature folders, focused files)**.

You will mostly live in **Authorization**, **Data isolation**, and **Verification**.

## 3. The two-path RLS model — the single most important thing to understand

Polaris reaches Postgres two ways, and **each table is protected for the path that
reads it**. Identity is injected differently on each path:

| Path | Connects as | Identity comes from | Tables (current) |
|---|---|---|---|
| **App / Drizzle** | non-superuser **`app_user`** | **GUCs** `app.user_id` + `app.user_roles`, set per-transaction by `withUserContext` | `orders`, `sign_in_log` |
| **Supabase client** | `authenticated` | **`auth.uid()`** from the session JWT | `profiles`, `realtime.messages` |

The reason there are two: the app does its real data work through **Drizzle as `app_user`**
(so it controls the connection and sets `app.user_id`), while auth/role reads and Realtime
go through the **Supabase client** (where only `auth.uid()` is available). A policy written
for one path is blind to the other — so you put a policy on the path that actually queries
the table.

**Concrete, from the live schema (`lib/db/schema.ts`):**
```ts
// APP PATH — app_user, app.user_id GUC:
orders_owner_or_self  TO app_user
  USING (created_by = current_setting('app.user_id', true)::uuid OR <owner-role>)
  WITH CHECK (created_by = current_setting('app.user_id', true)::uuid)

sign_in_log_owner_read TO app_user
  USING (<app.user_roles contains 'owner'>)  -- role-based, PII table

// SUPABASE PATH — authenticated, auth.uid():
profiles_select_self  TO authenticated  USING (id = auth.uid())
orders_read_own_topic TO authenticated  USING (realtime.topic() = 'orders:'||auth.uid() OR <owner firehose>)
```

**→ Everything you build (`organizations`, `memberships`, `orders.org_id`) lives on the
APP PATH.** You scope it with a **new GUC, `app.org_id`**, set by your **`withOrgContext`**
(the sibling of `withUserContext`). You are extending the left column.

## 4. Non-negotiable conventions

- **TDD always** (Principle 6). A pushed **red test is valid work** — it's the "Red" half.
- **One commit per feature · one branch per issue (`iam/<#>-slug`, off `clean-rewrite`)
  · one PR · merge no-squash** into `clean-rewrite` (preserve the TDD commit story).
  Each issue's PR is reviewed by the other intern before it merges.
- **App is non-superuser `app_user`; migrations use the privileged role.** Never grant
  `BYPASSRLS`. Never make a tenant table `USING (true)` to pass a test.
- **No secrets in code** (`.env*` is gitignored). **`auth.uid()`** vs **`app.user_id`** —
  use the right one for the table's path (see §3).
- **Roles are JSON-encoded** into `app.user_roles` (`@> '["owner"]'`), never comma-joined —
  a role name can't collide with a delimiter. Follow this for any role GUC you add.

## 5. The new-feature security checklist (THE gate — every PR answers this)

```
New DB table with tenant data?  → Enable RLS + scope policy + grant app_user + migration
                                  + an integration test proving ANOTHER tenant gets 0 rows.
New server action?              → withPermission(ctx => …) + (org context) + a CASL rule.
   …that writes?               → ALSO withRateLimit + a CASL create/transition rule.
Accepts user input?            → Zod .parse() BEFORE the work.
Acts on a record the user      → pass a CASL subject INSTANCE (instance-level authz),
   may not own?                  not RLS alone.
```
If a table or action is tenant-scoped and there is **no test where another tenant gets
zero rows / a thrown denial — it is not done.**

## 6. The patterns & files you mirror (don't reinvent — copy these)

| You're building | Mirror this existing thing | Path |
|---|---|---|
| `withOrgContext` (validate membership, set `app.org_id`, run tx) | `withUserContext` | `lib/db/with-user-context.ts` |
| `organizations` / `memberships` + RLS | `orders` table + `orders_owner_or_self` | `lib/db/schema.ts` |
| Org-scoped `orders` RLS | the existing `orders` policy | `lib/db/schema.ts` |
| `defineOrgAbilityFor` | `defineAbilityFor` | `lib/permissions/ability.ts` |
| Org-role gating in actions | `withPermission` | `lib/permissions/guard.ts` |
| RLS integration tests (every table) | `*-rls.integration.test.ts` + the harness | `lib/db/__tests__/` |
| Identity resolution | `getSessionUser` | `lib/auth/session.ts` |
| Non-superuser connection (never touch) | `db` client | `lib/db/client.ts` |

---

# PART II — THE IAM PROJECT

## 7. Mission (one paragraph)

Build the **identity & access layer** for the CRM: **organizations**, **users belonging
to organizations** with a role *per* org, and the **security** that scopes data to the org
you're acting in. Authentication is solved (Supabase Auth) — you build **authorization**.
The proof it works is one test (`IAM 11`): *a member of Org A can never see Org B's orders,
at the database, even if app code has a bug.* Make that pass honestly and the foundation is
sound.

## 8. Scope

**Build:** organizations · user↔org memberships with per-org roles · org-scoped RLS ·
org-scoped create/view of the existing bare `order` primitive.
**Don't build:** authentication (stays Supabase Auth) · billing · the full order domain
(F6) · invites-that-create-accounts (stretch / future F9). Foundation only — secure,
minimal.

**Two role axes** (internalize this):
- **System role** — `profiles.role` (`owner`/`member`), platform-wide, **already exists**.
- **Org role** — `memberships.role` (`org_admin`/`org_member`), authority *inside one org*,
  **what you build**. A user can be `org_admin` of A and `org_member` of B at once.

## 9. Data model

```
profiles      (exists)   id = auth.users.id · email · role        ← SYSTEM role
organizations (new)      id · name · created_by · created_at
memberships   (new)      id · org_id→organizations · user_id→profiles · role · created_at
                                                       UNIQUE(org_id, user_id)   ← ORG role
orders        (modify)   …existing… · org_id→organizations
```

## 10. Security architecture (how it plugs into Part I)

**Acting "inside" an org is route-scoped — no ambient state.** The current org is in the
URL: `/orgs/:orgId/...`. There is **no "current org" cookie** to forge. On every org
request the server: resolves the caller (`getSessionUser`) → calls **`withOrgContext(orgId,
fn)`**, which **validates membership first**, then sets `app.org_id` + `app.org_role` GUCs
and runs `fn` in a tx as `app_user`. A non-member **never** gets the GUC set → fail-closed.

**Defense in depth (Principle 2), made concrete:**
- **App layer:** `withOrgContext` refuses non-members; CASL gates the *action* by org role.
- **DB layer:** RLS scopes *rows* by `org_id = current_setting('app.org_id')::uuid`.

Both must pass. `IAM 11` proves the DB layer stands **alone** — even if you force
`app.org_id` to an org the user isn't in, RLS still returns zero, because the policy doesn't
depend on app code being correct.

**Provisioning (in scope now):** Ahmed (platform `owner`) creates auth users + `profiles`.
Inside the app an **`org_admin` adds an existing user to their org by email**. Invites that
create accounts are out of scope.

## 11. Setup (get green before touching anything)

```bash
git checkout clean-rewrite && git pull        # foundation lives here; branch your iam/<#> off it
npm ci
npx supabase start                 # local Supabase (Auth + Postgres + Realtime)
# put the printed keys in .env.local (shape = .env.test.example)
npm run db:migrate
npm test                           # unit         — must be green
npm run test:integration           # RLS harness   — must be green
```
Seed a few test users (no in-app registration): Supabase Studio → Auth → Add user
(auto-confirm) **+** a matching `profiles` row each, or script it like `e2e/global-setup.ts`.
You need ≥3 (`alice`, `bob`, `carol`) — two in one org, one in another. **If a fresh clone
isn't green, stop and ping Ahmed — don't build on red.**

## 12. Rules of engagement & security invariants

All of Part I §4–§5 applies. The invariants that **block a merge**:
- App connects as non-superuser `app_user`; migrations use the privileged role.
- `withOrgContext` validates membership **before** setting `app.org_id`.
- Every org-scoped table has an RLS policy **and** an isolation integration test.
- No swallowed authz errors; no `USING (true)` on a tenant table; no `BYPASSRLS`.

## 13. How vulturu & penut work it (neither siloed)

You're both backend; **there is no "DB person" or "UI person."** Any issue, either of you.
Two people = **review + relay**, not divided domains.
- **Take the two highest *ready* issues** (deps merged) that don't touch the same files. The
  dependency graph is built so two issues are almost always independently ready.
- **Pair (driver/navigator) on the 🤝 seams** — `IAM 5` (`withOrgContext`), `IAM 8` (orders
  RLS), `IAM 11` (the proof), `IAM 14` (E2E). Don't solo the seams.
- **Cross-review every PR.** The *other* intern approves; reviewer runs the §5 checklist +
  "is there an isolation test?". This is the real backstop and the best learning loop.
- **Exchangeable handoff:** push the branch (a **red test is fine**) + one comment on the
  issue ("Red for X pushed on `iam/5-…`; next is the action"). Issues are small enough that
  handoff is rare. Branch name `iam/<issue#>-slug` so anyone can find and continue it.

Rotate freely — the board, not a roster, decides who takes what.

## 14. The work — 14 issues across 4 milestones

Full TDD steps + acceptance + security gate live in each **GitHub issue**; the table is the
map. (`🤝` = pair.) Dependency graph:
```
IAM1 ─┬─ IAM2 ─┬─ IAM4
      │        ├─ IAM5(🤝) ─┬─ IAM6
      │        │            └─ IAM7
      IAM3 ────┘   IAM8(🤝) ─┬─ IAM9 ─┐
                             ├─ IAM10 ├─ IAM11(🤝) ─ IAM14(🤝)
                     IAM12 ──┴── IAM13 ┘
```

| Milestone | Issue | What |
|---|---|---|
| **M1 schema** | IAM 1 | `organizations` table + ownership RLS |
| | IAM 2 | `memberships` table + RLS + uniqueness |
| | IAM 3 | CASL org-role ability matrix (`defineOrgAbilityFor`) |
| **M2 ops** | IAM 4 | `createOrganization` (creator → `org_admin`, atomic) |
| | IAM 5 🤝 | `withOrgContext` — membership-validated GUC bridge |
| | IAM 6 | `addMemberByEmail` (`org_admin` only) |
| | IAM 7 | `listOrgMembers` (scoped read) |
| **M3 orders** | IAM 8 🤝 | `orders.org_id` + RLS rewrite to org scope |
| | IAM 9 | `createOrder` scoped to current org |
| | IAM 10 | `getOrders` scoped to current org |
| | IAM 11 🤝 | **cross-org isolation — the proof** |
| **M4 ship** | IAM 12 | `/orgs/[orgId]` route group + membership guard |
| | IAM 13 | minimal UI — org switcher, member list, orders |
| | IAM 14 🤝 | E2E — two users, two orgs, isolation over the wire |

## 15. Definition of done

- `npm test`, `test:integration`, `test:e2e`, `lint`, `build` all green on
  `clean-rewrite` after each issue's PR merges.
- Every org-scoped table: RLS policy **+** isolation test. `IAM 11` (DB) and `IAM 14`
  (wire) both pass **honestly**.
- `withOrgContext` validates membership before `app.org_id` — reviewed by both interns.
- Each feature = one no-squash PR, TDD commit story intact, reviewed by the other intern.

## 16. Stretch (only after the 14 ship green)

Invite-by-email that provisions accounts (real F9) · `org_owner` role + last-owner
protection · org switcher polish · tie orders to the F6 order domain when it lands.

## 17. When in doubt

The §5 checklist *is* the spec for "is this secure?". If a test is hard to make pass
**honestly**, the design is telling you something — ask in the PR before weakening anything.
**A pushed red test + a question beats a green test that lies.**
