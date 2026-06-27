# Chroma & Chroma MCP — Agentic AI Exploration for Polaris

> **Status:** Exploration / plan only. **Nothing is being built or added** by this
> document. It maps what Chroma + Chroma MCP are, what they could do for a
> cold-chain logistics order SaaS, the honest trade-offs (incl. the pgvector
> fork), and a phased integration path. Decisions are deferred.
>
> **Date:** 2026-06-08 · **Author:** exploration spike
> **Domain context:** Polaris = internal cold-chain logistics **order management**
> being rebuilt onto a self-hostable stack (Keycloak identity, Centrifugo
> realtime, Postgres as DB). See `docs/HANDBOOK.md`.

---

## 1. What Chroma is (and isn't)

**Chroma** is an open-source (Apache-2.0) **retrieval / search engine for AI** —
a "vector database." You put in documents (text, and increasingly images/audio)
plus structured **metadata**; Chroma stores their **embeddings** and lets you
retrieve by:

- **Dense vector search** (semantic similarity)
- **Sparse vector + full-text / regex search** (keyword)
- **Hybrid** (dense + sparse combined)
- **Metadata filtering** (constrain by `org_id`, `status`, numbers, booleans, arrays)

It is organized into **collections** (think "tables of embedded documents").
Recent (2026) platform notes: a distributed architecture (gateway / log / query
executor / compactor / sysdb) with a write-ahead log + compaction; copy-on-write
collection duplication; metadata arrays with native array filtering; private
networking (AWS PrivateLink / GCP PSC) on **Chroma Cloud**.

**Deployment options:**
- **Local persistent** (Python, file-backed) — dev only.
- **Single-node Docker** (`chromadb/chroma`) — self-hostable server over REST.
- **Distributed / Chroma Cloud** — managed, serverless.

**Embeddings:** bring-your-own or built-in functions — `default`
(local sentence-transformers, free, lower quality), `openai`, `cohere`, `jina`,
`voyageai`, `roboflow`.

### Critical architectural fact for Polaris
The **JavaScript/TypeScript client (`chromadb` npm) is a REST client — it
requires a running Chroma server.** There is **no in-process embedded Chroma for
Node**. So integrating into our Next.js/Node app means **running Chroma as a
separate stateful service** (Docker, alongside Keycloak/Centrifugo) **or** using
**Chroma Cloud**. This is the same shape as our other infra services — but it's
*another* stateful service to run, back up, and secure.

---

## 2. What Chroma MCP is (and how it differs from "using Chroma")

There are **two distinct ways** Chroma shows up, and conflating them causes bad
architecture decisions:

### (a) Chroma the database, via the `chromadb` JS client — **for product features**
The app calls Chroma directly, server-side, with deterministic, app-controlled
queries. We own the query, the tenant filter, the auth. **This is the right path
for customer-facing retrieval features** (RAG, semantic search) because we must
enforce isolation and never let a model freelance a cross-tenant query.

### (b) Chroma **MCP server** — Chroma exposed as **agent tools**
`chroma-mcp` (run via `uvx chroma-mcp`) is a Model Context Protocol server that
exposes **12 tools** an LLM/agent can call:

| Category | Tools |
|---|---|
| Collections | `chroma_list_collections`, `chroma_create_collection`, `chroma_peek_collection`, `chroma_get_collection_info`, `chroma_get_collection_count`, `chroma_modify_collection`, `chroma_delete_collection` |
| Documents | `chroma_add_documents`, `chroma_query_documents`, `chroma_get_documents`, `chroma_update_documents`, `chroma_delete_documents` |

Client types: `ephemeral` / `persistent` / `http` (self-hosted) / `cloud`.
Configured via `--client-type`, `--host`, `--api-key`, `CHROMA_*` env vars.

**Two legitimate uses of the MCP server:**
- **Internal / dev-agent memory** — wire `chroma-mcp` into Claude Code / Claude
  Desktop so *our coding & ops agents* gain institutional memory (ADRs, the
  ROADMAP, past incidents, decisions). **Low-risk, high-leverage, independent of
  the product** — can be trialed immediately without touching the app.
- **The product's own agent runtime** — if we build an in-app agent that consumes
  MCP tools, Chroma MCP could be one of its tools. **But** for customer data we'd
  almost certainly wrap it (or use the JS client) behind a tenant-scoping guard
  rather than hand the raw 12 tools to a model — `chroma_delete_collection` in an
  LLM's toolbox over a multi-tenant store is a footgun.

> **Takeaway:** Use **Chroma MCP** to give *agents we operate* memory/retrieval.
> Use the **JS client behind a guard** for *features we ship to customers*.

---

## 3. The "deep agentic AI" opportunity — what it could actually do here

"Agentic AI" = an LLM that **plans, uses tools, and carries memory** across
multiple steps. Chroma is the **memory + retrieval substrate** — necessary but
not the whole agent. The agent's *other* half is its **tools**, which in Polaris
are the **server actions we just hardened this session** (`createOrder`, status
transitions, etc., now guarded by Zod + CASL + RLS + rate-limiting). That
hardening is, conveniently, exactly the safe tool surface an agent needs.

Concrete, domain-specific possibilities (ranked roughly by value/effort):

### Tier 1 — high value, retrieval-shaped (Chroma is a clean fit)
1. **Operational knowledge RAG.** Cold-chain runs on SOPs, GDP/Good Distribution
   Practice, carrier contracts, per-product temperature specs, IATA/FDA rules.
   Embed them → an agent answers "max excursion time for this vaccine?" / "which
   carriers are approved for the Boston pharma lane?" with citations.
2. **Similar-case / historical retrieval.** Embed past orders + their outcomes
   (delays, excursions, resolutions). "Find orders like this one" surfaces how
   comparable situations were handled — the backbone of risk-surfacing and an
   agent that "learns from history."
3. **Agent long-term memory.** Per-user / per-customer memories: "ACME always
   wants dry-ice top-off," "this lane has customs delays," recurring order
   patterns, prior preferences. The canonical Chroma "LLM memory" use case.

### Tier 2 — agentic, action-taking (Chroma supports, agent does the work)
4. **Conversational order copilot.** "Reorder last month's penicillin shipment to
   the Boston cold store." Agent: semantic search to resolve fuzzy entities
   (customer/product/lane) → calls the guarded `createOrder` tool →
   human-in-the-loop confirm. Retrieval (Chroma) + tools (our actions) + memory.
5. **Exception / incident triage.** A temp excursion or delayed shipment fires →
   agent retrieves similar past incidents + resolutions (Chroma), drafts customer
   comms, proposes the next status transition. Pairs naturally with **Centrifugo
   (F7)** for a live ops copilot.

### Tier 3 — nice-to-have / analytics-adjacent
6. **Document understanding (multimodal).** Embed POD/BOL/packing-list text and
   photos of damaged goods (Chroma is multi-modal) for search + agent retrieval.
7. **Demand/anomaly surfacing.** Cluster customer/product order patterns; flag
   "ACME usually orders weekly, silent 3 weeks." (Often better served by plain
   SQL analytics than vectors — include only if semantic grouping earns it.)

---

## 4. Where it would sit — integration architecture (sketch, not a build)

```
                        ┌─────────────────────────────┐
   Postgres (SoT) ──────►  Sync pipeline (embed+upsert) ──────► Chroma (index)
   orders, customers,   │  on create/update/delete           collections w/
   docs, KB             │  (inline action hook OR             org_id metadata
        ▲               │   pg LISTEN/NOTIFY job)                   │
        │ guarded                                                  │ tenant-scoped
        │ tools (Zod/CASL/RLS/rate-limit)                          │ query
        │                                                          ▼
   ┌────┴───────────────────────────────────────────────────────────────┐
   │  Agent runtime (LLM + planner)                                        │
   │   • tools = existing server actions (write) + vector retrieval (read) │
   │   • memory = Chroma collection (per user/org)                         │
   │   • Anthropic Claude (latest) as the model                           │
   └──────────────────────────────────────────────────────────────────────┘
```

Key design rules:
- **Postgres remains the source of truth.** Chroma is a **derived, rebuildable
  index/memory** — never authoritative. Everything in Chroma must be
  reconstructable from Postgres.
- **A sync pipeline** keeps Chroma eventually-consistent: on order
  create/update/delete, embed the relevant text + upsert (or delete) in Chroma.
  Candidate mechanisms: inline in the server action (simple, couples latency),
  or a background worker fed by **Postgres `LISTEN/NOTIFY`** (we're already
  considering `pg-listen` for realtime — could share it). Decide later.
- **The agent acts through the existing guards**, never around them. Reads go
  through a tenant-scoped vector wrapper; writes go through `withPermission` +
  `withUserContext` + `withRateLimit` (already built). Human-in-the-loop for
  mutations; audit via `supa_audit` (F10).

---

## 5. The non-negotiable: tenant isolation in the vector layer

This is **the** risk and it deserves first-class design, because **Chroma has no
RLS.** Postgres enforces per-user/per-org isolation in the database; a vector
store does not. If an agent retrieves across tenants, that's a **cross-customer
data breach** — far worse than a UI bug.

Mitigations (mirror our DB discipline):
- **Mandatory tenant filter on every query.** A `withVectorContext`-style wrapper
  (analogous to `withUserContext`) that **always** injects `where: { org_id }` /
  `{ user_id }` — never trusting the caller (or the LLM) to add it. A query
  without a tenant scope should be **impossible to express**, not merely
  discouraged.
- **And/or collection-per-tenant** (Chroma's copy-on-write makes this cheap) so
  isolation is structural, not filter-dependent. Trade-off: many collections to
  manage.
- **Never hand the raw `chroma_*` MCP tools to a customer-facing model.** Wrap
  them; strip destructive ones (`delete_collection`, cross-collection reads).
- This becomes acute at **F12 (multi-customer / org model)** — the vector
  isolation model should be designed *with* F12's `org_id`, not bolted on.

Also: **data residency / compliance.** Cold-chain often means **pharma (regulated
under GDP/FDA)**. That argues against **Chroma Cloud** (data leaves our infra) and
against **API embedding providers** without a DPA — favoring **self-hosted Chroma
+ local/self-hosted embeddings**, consistent with Polaris's self-host ethos.

---

## 6. The honest fork: Chroma vs. pgvector

**We already run Postgres.** `pgvector` adds vector columns + similarity search
*inside our existing database*. Before adopting Chroma, weigh:

| | **pgvector** (extension in our Postgres) | **Chroma** (dedicated service) |
|---|---|---|
| New infra | None — already have Postgres | **Another stateful service** (Docker/Cloud) to run, back up, secure |
| Tenant isolation | **Free via existing RLS** | Must build (filters/collections) — the #5 risk |
| Source-of-truth sync | None — vectors live next to the row | Needs a sync pipeline |
| Hybrid/full-text/multimodal | Decent (FTS + pgvector), more manual | First-class, richer |
| Scale (10M+ vectors) | Good, eventually tuning-heavy | Built for it; distributed/Cloud |
| Agent/MCP ecosystem | DIY | **Chroma MCP** out of the box |
| Ops surface | Smallest | Larger |

**Reading:** For a small-team, self-hostable SaaS that *already* runs Postgres +
Keycloak + Centrifugo, **pgvector is the pragmatic first move** — it reuses RLS
(solving the #5 risk for free) and adds zero services. **Chroma earns its place
when** we need scale, strong hybrid/multimodal retrieval, copy-on-write
per-tenant collections, or want the **MCP-native agent tooling** — and we're
willing to run another stateful service with its own isolation layer.

> A reasonable strategy: **prove the agentic value on pgvector first** (cheap,
> safe, RLS-isolated). **Promote to Chroma** if/when retrieval scale or features
> demand it — the embedding pipeline and agent design largely carry over.
> Independently, adopt **Chroma MCP for internal/dev-agent memory now** (no
> product risk).

---

## 7. Phased path (when, not now)

This is a **Phase 2/3+ initiative** — *after* the core migration (F6 orders-domain
→ F8 orders-UI → F7 Centrifugo realtime) is stable. Don't fork attention from the
migration. Sequencing when it's time:

- **Phase 0 — Internal dev/ops agent memory (independent, low-risk).** Wire
  `chroma-mcp` into Claude Code/Desktop over a local Chroma; load ADRs, ROADMAP,
  incident notes. Validates Chroma + MCP with zero product/customer exposure.
- **Phase A — Retrieval substrate (no user-facing AI).** Choose pgvector **or**
  Chroma; stand it up; build the **tenant-scoped retrieval wrapper** and the
  **Postgres→index sync pipeline**; decide the embedding model (lean self-hosted
  for pharma). Parity/isolation tests. (Aligns with **F12** org model.)
- **Phase B — Read-only RAG assistant.** "Ask your orders / knowledge base" —
  semantic search + cited Q&A, **read-only**, tenant-scoped. Proves retrieval
  quality + isolation before any mutation.
- **Phase C — Agent memory.** Persistent per-user/per-customer memory.
- **Phase D — Action-taking agent.** Agent calls the **guarded** server actions
  (create/transition) with **human-in-the-loop** confirmation + audit (F10) +
  rate-limiting (done).
- **Phase E — Proactive ops copilot.** Incident triage + anomaly surfacing,
  fused with **Centrifugo (F7)** for live assistance.

---

## 8. Open decisions (resolve before any build)

1. **pgvector vs Chroma** for the first product feature (§6).
2. **Self-hosted Chroma vs Chroma Cloud** — data residency for pharma (§5).
3. **Embedding model** — local/self-hosted (privacy) vs API (quality/cost).
4. **Agent runtime** — Anthropic Claude (latest) as the model; build our own
   tool-loop vs a framework; does it consume **MCP tools** or call services
   directly?
5. **Tenant isolation model** — mandatory metadata filter vs collection-per-tenant
   (or both), designed with **F12**.
6. **Sync mechanism** — inline action hook vs `pg LISTEN/NOTIFY` worker (share
   with realtime?).
7. **Human-in-the-loop policy** + **audit** for agent mutations.
8. **Compliance** — what GDP/FDA constraints apply to AI over regulated order data?

---

## 9. Bottom line

- **Chroma** is a strong, self-hostable retrieval engine; **Chroma MCP** cleanly
  exposes it as agent tools (12 tools, 4 client modes).
- The **agentic value** (copilot, triage, memory) comes mostly from the **agent
  (LLM + tools + planning)**; Chroma supplies the **memory/retrieval substrate**.
  Our **already-hardened server actions are the safe tool surface** that makes an
  action-taking agent viable.
- **Biggest risk:** **tenant isolation** — a vector store has no RLS; this must be
  designed like RLS from day one, ideally with **F12**.
- **Most pragmatic first step:** **pgvector** (reuses Postgres + RLS, zero new
  services) to prove value; **promote to Chroma** for scale/hybrid/multimodal/MCP.
  Separately, **Chroma MCP for internal dev-agent memory is a safe, immediate
  experiment.**
- **Timing:** **Phase 2/3+**, after F6 → F8 → F7. Not now.

---

## Sources
- [Chroma — trychroma.com](https://www.trychroma.com/)
- [Chroma Docs — Introduction](https://docs.trychroma.com/docs/overview/introduction)
- [Chroma Docs — Getting Started (TypeScript)](https://docs.trychroma.com/docs/overview/getting-started?lang=typescript)
- [Chroma Docs — Client/Server Mode](https://docs.trychroma.com/production/chroma-server/client-server-mode)
- [chroma-core/chroma (GitHub)](https://github.com/chroma-core/chroma)
- [chroma-core/chroma-mcp (GitHub)](https://github.com/chroma-core/chroma-mcp)
- [chromadb — npm (JS/TS client)](https://www.npmjs.com/package/chromadb)
- [Anthropic MCP — Chroma Docs](https://docs.trychroma.com/integrations/frameworks/anthropic-mcp)
- [Vector DB comparison 2026 — groovyweb](https://www.groovyweb.co/blog/vector-database-comparison-2026)
