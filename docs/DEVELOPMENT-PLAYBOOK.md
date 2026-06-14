# Development Playbook — How the Polaris Foundation Was Built

A worked example, distilled from the session that produced `main` (the 34-commit foundation). It is not a description of *what* was built — that's `HANDBOOK.md` — but of *how*, so the same discipline can be repeated. Read it as a sequence of moves, each with the reasoning that justified it.

> **The one-sentence version:** turn intent into a constitution, the constitution into a linear test-first plan, the plan into reviewed commits — and make the rules machine-enforced so the process survives contact with reality (including the builder's own mistakes).

---

## The arc

```
Intent  →  Understand  →  Constitution  →  Plan  →  Build instructions  →  Execute  →  Govern
(vague)    (evidence)     (boundaries)    (TDD seq)  (per-commit specs)    (subagents)  (branch/CI/docs)
```

Each stage produced a durable artifact and gated the next. Nothing was built until the stage before it was approved.

---

## 1. Don't start building. Start understanding — from evidence, in parallel.

The request was "make a clean foundation." The temptation is to start scaffolding. Instead:

- **Three parallel research agents** were dispatched at once, each with a narrow brief and a structured-report contract: one read the *git history* (144 messy commits — what survived, what was undone), one digested the *docs*, one mapped the *current code*. Parallel because the three are independent; structured because their output fed the next stage, not a human.
- The payoff was a **churn ledger**: the predecessor had adopted Keycloak + Centrifugo and ripped them out (~57 commits of round-trip). That single finding reframed the whole project — the goal wasn't "rebuild," it was "keep the audited end-state, lose the history, and never repeat the detour."

**Move:** before designing, separate *what the work converged on* (keep) from *what it thrashed on* (the lessons). Use parallel sub-agents for independent fan-out research and demand structured reports, not file dumps.

## 2. Make the trade-off explicit, then let the human choose.

Two real decision points were surfaced as plain-language choices, not buried in jargon:

- **What is "minimum core"?** → three options (pure foundation / generic exemplar / keep the real domain). The human picked the exemplar.
- **Is copying audited code really TDD?** → stated honestly that re-staging existing code is "TDD-shaped verification, not authorship." Once it was plain, the human chose the stricter path: *fresh derivation, no copying.*

**Move:** when a shortcut around a discipline is tempting, present the honest cost in plain words. People pick rigor when they can actually see the trade — and jargon hides it.

## 3. Write the constitution before any code (`DOMAIN-CHARTER.md`).

The design wasn't a sketch; it was **law**:

- **Domains** with single responsibilities, each owning named files and a public contract.
- **Iron Rules** as a dependency law: *foundation never imports features; features never import each other; composition roots are the only wiring points.* Plus the security invariants (two RLS paths, channel-layer realtime, fail-closed everything).
- **Composition roots**: the exact, small set of files a new feature is allowed to touch.
- A **disposable exemplar** (`notes`) defined up front as the copy-paste template — *with deletion as an acceptance criterion*.

**Move:** express architecture as boundaries + invariants + "never" rules, not prose. A boundary you can't state as a rule is a boundary you can't enforce.

## 4. Turn the constitution into a linear, test-first plan — and audit your own plan against the discipline.

The plan (`CLEAN-REWRITE-2-PLAN.md`) sequenced **33 commits in phases**, CI before features, with three columns made explicit only after the human pushed back:

- **what we do** (deliverable),
- **what proves it** (the red test),
- **what we use** (a per-commit bill of materials; dependencies enter at first use).

Then the plan was **graded against the TDD skill itself**, producing an honest "fidelity ledger": which commits are authentic TDD, which are config/docs (exempt), and where ordering deviates (async components testable only at E2E). Deviations were *recorded, not hidden*.

**Move:** a plan that claims a discipline must be checked against that discipline. Write down where you can't fully honor it and why — that honesty is what makes the claim trustworthy.

## 5. Write build instructions an agent (or intern) can execute blind.

`CLEAN-REWRITE-2-BUILD.md` gave every commit: exact files, contracts (signatures), a numbered **behavior checklist with exact expected values**, commands, and the commit message — but **no production code**. Pre-writing the code would have been copying with extra steps; the point was to derive it from the checklist.

The checklists were distilled *once* from the predecessor's ~91 tests (a deep read), so during construction **the old branch stayed closed**. That "reference firewall" is what kept it genuine derivation instead of transcription.

**Move:** specify behavior and contracts exhaustively; leave the implementation to the test-driven moment. Read your reference deeply once, then put it away.

## 6. Execute as reviewed, isolated commits — never trust the report.

Subagent-driven execution, one task per commit:

- A **fresh agent per commit** got only its checklist (clean context, no session pollution). It verified it was on the right branch/SHA as its *first* action.
- Each agent worked **strict red→green→refactor**, observing the red *for the right reason* — and where a later cycle would have passed on arrival, it deliberately regressed the implementation to prove the test bites.
- After phases, **independent quality reviewers** re-ran suites and read the diffs — explicitly told *not to trust the implementer's report*. They verified external API claims against installed types, not memory.
- Every commit passed the gate **in force at that point in history** (unit → +integration → +live-DB → +E2E), with explicit exit codes — never a piped command that could mask a failure.

**Move:** isolate, verify, and adversarially review. The implementer's "done" is a hypothesis; the reviewer's independent run is the evidence.

## 7. Make the rules machine-enforced — and let them catch *you*.

The charter's boundaries weren't honor-system:

- an **import-boundary scanner** fails the build on any illegal import;
- a **feature-confinement test** fails if the exemplar's name appears outside its sanctioned footprint;
- the **deletion rehearsal** actually deleted `notes` in a scratch worktree and proved the foundation stayed green.

These earned their keep: the confinement test **caught the orchestrator** (me) leaking a feature name into the CI config — a mistake compounded by a piped command that hid the failing exit code. The fix went into the config, not the test ("fix the plan, never the test"), and because the branch was unpublished, the commit was repaired in place so history stayed green.

**Move:** encode every rule you care about as a test that fails the build. The rule that can catch its author is the only kind worth trusting.

## 8. Govern the result: branch, CI, docs.

- The foundation became `main`; the old product line was preserved as `main-legacy` / `main-archive`; the audited reference stayed as `clean-rewrite`. The rename used GitHub's API (redirect-preserving), and CI triggers were retargeted **first** so the pipeline never pointed at a dead branch.
- The **fresh-clone CI** — the original pain that triggered the whole rewrite — was proven on a cold runner: `npm ci`, a real Supabase stack spun up, live RLS suites *required* to run (skipping = hard failure), all E2E green.
- Documentation was layered with **one fact, one home**: `HANDBOOK` (system) → `CHARTER` (law) → `CONTRIBUTING` (practice) → `ADRs` (why) → `README` (front door). Each cites the others; none restates them.

**Move:** finish by making the work findable and continuously re-proven. A foundation nobody can navigate, or that only passed once, isn't a foundation.

---

## Principles that recur

| Principle | Where it showed up |
|---|---|
| **Evidence over memory** | parallel archaeology agents; reviewers verifying against installed types |
| **Plain words before jargon** | every decision surfaced as a human-readable trade-off |
| **Honesty about discipline** | the TDD fidelity ledger; recorded deviations; "TDD-shaped, not authorship" |
| **Boundaries as law, enforced by machines** | Iron Rules → scanner + confinement test → caught the author |
| **Fix the plan, never the test** | the CI-config leak repair |
| **One fact, one home** | the cite-don't-restate doc hierarchy |
| **Isolate and adversarially verify** | fresh agent per commit; don't-trust-the-report reviews |
| **Prove it continuously, not once** | fresh-clone CI, live-DB hard-fail gate, confinement test |

## Anti-patterns this process avoids

- **Building before understanding** — the churn ledger prevented re-walking the Keycloak detour.
- **Copying dressed as TDD** — the reference firewall + fresh derivation.
- **Boundaries as documentation** — they're tests; docs that aren't enforced rot (the predecessor's source-of-truth handbook was *gitignored*).
- **Green-by-luck** — observing red for the right reason; explicit exit codes over piped commands.
- **Trusting the implementer** — two-stage independent review per phase.
- **A plan that lies about its own rigor** — the self-audit against the TDD skill.

---

---

# Part II — The Coding Practices

Part I was *how the work was run*. This part is *how the code is written* — the patterns that recur in the source itself, each with the problem it solves. These are the conventions a new feature inherits by copying the `notes` exemplar, and the ones a reviewer checks against.

> **The one-sentence version:** every value is validated at its boundary, every decision fails closed, every dependency points inward toward the foundation, and every rule is a type or a test — so correctness is structural, not remembered.

---

## A. Shape: dependencies point inward, features plug in

The architecture is a classic **dependency inversion**, enforced rather than hoped for.

- **Foundation never imports features.** `lib/**` knows nothing about `app/_features/**`. Features depend on foundation contracts; the arrow only points one way. (Iron Rules 1–2.)
- **Composition roots are the only seams.** A feature reaches the foundation through exactly three registry files — `lib/registry/{abilities,nav,schema}.ts` — each a flat list with zero logic. Adding a feature is its folder plus three one-line registrations; removing it is the reverse diff. (Charter §3.)
- **The contributor pattern** makes the seam type-safe: a feature's `permissions.ts` exports an `AbilityContributor` that receives only `can` — never `cannot`, never `build`. A feature *physically cannot* express a deny rule or finalize the ability object. The type enforces "features grant, the foundation composes."
- **The factory pattern** keeps shared machinery generic: the foundation ships `createRateLimiter(...)`; each feature instantiates and owns its own limiter in its own folder. The foundation holds no feature-specific instances. (This inverts a real weld from the predecessor, where an `orderWriteLimiter` lived in shared code.)
- **The dev-API barrel** (`index.ts` per feature; Iron Rule 8 / [ADR-0005](adr/0005-feature-dev-api.md)): outsiders import `@/app/_features/<name>` and nothing deeper. Whatever isn't re-exported there is private. The barrel is the feature's published surface — and it deliberately never re-exports the manifests (those are wired only through the registries).

**Why it matters:** you can understand, test, change, or delete any feature in isolation, because the blast radius is bounded by construction. The boundary scanner and confinement test fail the build if the arrow ever reverses.

## B. Security as code: fail closed, in depth, least privilege

Every security property is expressed as a default-deny mechanism, and never as a single layer.

- **Fail closed is the default everywhere.** No session → the guard throws *before* any permission is evaluated. Empty ability registry → nothing is granted. Missing identity GUC → the RLS policy `coalesce(..., false)` denies. Invalid env → the process refuses to boot. Bad UUID → rejected before it can reach a `::uuid` cast. The safe state is the one you fall into when something is absent.
- **Defense in depth — two independent layers per operation.** CASL gates the *action* (`withPermission`); RLS gates the *rows* (`app_user` policies). Either alone stops an attacker; both must agree for an operation to succeed. The proxy gates routes for hygiene but is *never* trusted for authorization — server actions self-guard, because a Server Action POST can bypass a proxy matcher.
- **The self-guard pipeline is a fixed, ordered contract** in every action: `withPermission` → `withRateLimit` → Zod parse → `withUserContext`. Order is load-bearing (validation lives *inside* the limiter so abusive invalid spam still consumes budget; the cache revalidation fires only after the whole chain resolves). It is documented as contractual and pinned by tests that deliberately reorder it to prove the order is real.
- **Least privilege at the connection.** The app connects as a non-superuser `app_user` with no `BYPASSRLS`; migrations run as a separate privileged role. Tests connect as the *real* `app_user` so RLS actually binds — a superuser test would silently pass through every policy.
- **Two distinct error vocabularies**, because the distinction is a security fact: `Not authenticated` (no session) vs `Not authorized` (CASL denial), the former checked first.
- **The write-lock pattern** turns a silent failure into a loud one: `profiles` write grants are *revoked* from `authenticated`, so a self-escalation attempt fails with `permission denied` rather than matching zero rows. A loud denial is auditable; a silent no-op is a latent bug.

**Why it matters:** an attacker has to defeat every layer; a careless future change usually trips a layer and fails the build rather than opening a hole.

## C. Data & migrations: one authority, dual-target, injection-proof

- **Drizzle is the sole migration authority** — there is no `supabase/migrations/`. Schema is source-controlled; the same `drizzle/*.sql` files apply in dev, CI, and tests.
- **Hybrid generated + hand-written SQL.** Drizzle generates what it can express (tables, RLS-enable, the role); grants, revokes, policies, and trigger functions are hand-appended to the generated file. Policies live in the *migration*, not the schema slice — because declaring them in the slice makes the next `db:generate` re-emit them *unguarded*, drifting from the hand-edited version. The slice carries a pointer comment instead.
- **Schema-guarded DDL for portability.** Supabase-only objects (`auth.uid()` policies, `realtime` triggers) are wrapped in `DO $$ IF EXISTS (schema 'auth'|'realtime') ... END $$`, so the identical migration set applies cleanly to a vanilla-Postgres test container (guards no-op) *and* live Supabase (guards fire). One migration history, two targets, proven by a smoke test every run.
- **Two RLS identity paths, never mixed.** App-path tables read identity from transaction-scoped GUCs (`app.user_id` / `app.user_roles`); Supabase-path tables read `auth.uid()`. A policy written for one path is blind to the other, so each policy goes on the path that actually queries the table.
- **Injection-proofing by construction.** Roles are JSON-encoded into the GUC and checked with JSONB `@>` containment — so a role literally named `x,owner` can never splice the check (whole-element match, not string-split). GUCs are set with `set_config(..., true)` (transaction-scoped) so identity can't leak across a pooled connection. Identity values are parameterized, never interpolated.

**Why it matters:** the database enforces tenancy even if the application code is wrong, and the test environment is cheap (a throwaway container) without lying about how production behaves.

## D. Async, React, and framework-specific care

- **Best-effort side effects never block the critical path.** `recordSignIn` wraps its insert in try/catch and logs a warning on failure — an audit-table outage must never prevent a login. The thing that *must* happen and the thing that's *nice to record* are separated by an error boundary.
- **Logging vs. audit are different systems.** Pino carries operational/ephemeral events (errors, denials); durable facts (successful logins) go to a database table. Never conflate "what happened operationally" with "what is a business record."
- **Hydration handled correctly, not hacked.** The login form defers its real render until hydration via `useSyncExternalStore` (server snapshot `false`, client `true`) — not a `setState`-in-effect mount flag (which the lint rules correctly forbid). Framework idioms over clever workarounds.
- **Client/server boundaries are explicit.** A cookie-bound server client (reads/writes auth cookies, swallows the write that Server Components can't perform — the proxy owns refresh); a singleton browser client (one socket, configured once). Each has one construction site.
- **Realtime is gated where identity is reliable.** Delivery filtering is *never* row-RLS on a streamed table (the realtime authorizer can't see app GUCs and doesn't reliably resolve `auth.uid()` row-by-row — the "0021 scar"). Instead a trigger broadcasts to per-user topics and an RLS policy on `realtime.messages` gates subscriptions, where the subscriber's JWT *is* loaded. A hard-won platform fact, encoded as a reusable template so no one re-learns it.

**Why it matters:** the failure modes that bite hardest in this stack — blocked logins, hydration mismatches, silent realtime drops — are each closed off by a deliberate pattern rather than rediscovered per feature.

## E. Testing practices: mock at the edges, run for real in the middle, never green by luck

- **Three tiers, each testing what it should.** Unit tests mock at the *boundary* (the DB client, the Supabase client) and verify logic. Integration tests run against a *real* Postgres as the *real* `app_user` — RLS is only meaningfully tested when it actually binds. E2E drives a browser against a live Supabase stack.
- **Test the real seam, not a mock echo.** The guard and ability tests mock the *registry* (supplying a test contributor) and exercise the *real* `buildAbility` — proving the wiring, not a reflection of a stub. A test that only confirms a mock returns what you told it to is theater.
- **Observe red for the right reason.** Every test is watched failing *before* the implementation, and failing because the feature is *missing* — not because of a typo or import error. Where a later cycle would pass on arrival, the implementation is *transiently regressed* to prove the test actually bites.
- **Test the tests.** The boundary and confinement scanners are themselves driven by planted-violation fixtures: a deliberate bad import must fail the scanner (naming the offender) before it's removed. A guard you haven't watched catch something is a guard you don't trust.
- **No silent skips on safety-critical suites.** The live-Supabase RLS suites self-skip locally (so a dev without the stack stays green) but *hard-fail* in CI under `CI_REQUIRE_LIVE_DB=1` — a skipped isolation test that should have run is a false green, and false green is worse than red.
- **Honest exit codes.** Gates are run as discrete commands with checked exit codes, never piped — because a pipe can mask a failing status (this exact masking once hid a real failure during construction).

**Why it matters:** the test suite is the thing future contributors trust to refactor safely. Every practice here is about making a green run *mean* something.

## F. TypeScript & commit hygiene

- **Contracts as signatures; structural types over deep imports.** A transaction handle is derived as `Parameters<Parameters<typeof db.transaction>[0]>[0]` rather than reaching into Drizzle internals. No unjustified `any` or casts; where a runtime-only shape must be tested, the cast is narrow and commented.
- **`as const` for config**, so literals stay narrow (branding, header sets).
- **Conventional Commits, linear history.** Small, scoped, green commits (`feat(notes): …`, `fix(rls): …`); rebase-and-fast-forward, no merge bubbles — the red→green commit story *is* the review artifact, so it's preserved, not squashed.
- **Dependencies enter at first use**, in the commit whose failing test justifies them — the history doubles as a dependency review. Any dependency change regenerates the lockfile from scratch (no incremental patching).
- **One fact, one home** extends to code: tenant strings live only in `lib/branding.ts`; the env object is the only reader of `process.env`; there is exactly one identity resolver. Duplication of a *source of truth* is treated as a defect.

**Why it matters:** the types catch the mistakes the tests don't, and a clean linear history means `git log` and `git blame` stay legible as the system grows.

---

## How the two parts connect

Part I's discipline produces Part II's properties. Test-first authoring is *why* fail-closed is pervasive (you write the denial test first). The constitution is *why* dependencies point inward (the Iron Rules are encoded as scanners). The reference-firewall derivation is *why* the patterns are coherent rather than copied-and-drifted. And machine-enforced rules are *why* all of it survives the next contributor — including the one who copies `notes` at 2am and forgets a boundary. The build will tell them.

---

*This document is a process-and-practice artifact, not a spec. The system it produced is described in `HANDBOOK.md`; the rules it follows are in `DOMAIN-CHARTER.md`; the feature workflow is in `CONTRIBUTING.md`.*
