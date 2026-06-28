# Routes & Maps — Org Addresses, Routes & Map Visualization

Exploratory framework on top of the IAM foundation, built by **@Vulturu1 + @penut101**.
The geographic spine for fulfillment: org-scoped **addresses**, **routes** (ordered subsets of addresses), and Google Maps visualization. Optimization, manifests, and driver/warehouse views are the *next* project — out of scope here.

> **Status:** READY — assigned to @Vulturu1 + @penut101. Branch `maps/<#>-slug` off the IAM-foundation branch (orgs + memberships + `withOrgContext`); PR back to it. Assumes you're already set up — you built the IAM foundation, so the codebase, RLS patterns, and TDD loop are familiar.

## The goal
Log in → see your org's customer **addresses** on a Google Map → build a **route** (an ordered subset of those addresses) → it draws on the map with total distance + ETA → insert a detour and it redraws. Org-scoped at the database — a member of Org A never sees Org B's addresses or routes — proven over the wire by #218 (E2E).

## Domain model (new tenant tables — same isolation rules as `orders`)
- **address** — belongs to an org; raw text geocoded to `lat`/`lng`.
- **route** — belongs to an org; a named, ordered set of stops.
- **route_stop** — `(route_id, address_id, position)`; the ordered subset.

Reuse `withOrgContext` + the org RLS pattern. **Template for everything: `app/_features/orgs/`** — same shapes you already built.

## Prerequisite (one-time, not a task)
A Google Maps Platform project with **Maps JavaScript**, **Geocoding**, and **Directions** enabled. Two keys: a referrer-restricted **browser** key (the map) and a server-only key (Geocoding/Directions), added via the repo's env validation.

## Issues by milestone

**M1 — Address model & geocoding**
- [ ] #205 · MAPS 1 — `addresses` table + org-scoped RLS
- [ ] #206 · MAPS 2 — geocoding service (raw text → `lat`/`lng`)
- [ ] #209 · MAPS 3 — `createAddress` action (Zod + geocode + permission)
- [ ] #210 · MAPS 4 — `listAddresses` (scoped read)

**M2 — Map & markers**
- [ ] #211 · MAPS 5 — map shell: a Google Map behind auth 🔬
- [ ] #212 · MAPS 6 — plot org addresses: markers + info windows 🔬
- [ ] #213 · MAPS 7 — add-address form 🔬

**M3 — Route model**
- [ ] #214 · MAPS 8 — `routes` + `route_stops` tables + org-scoped RLS
- [ ] #207 · MAPS 9 — route actions: `createRoute` + reorder/add/remove stops
- [ ] #208 · MAPS 10 — `listRoutes` / `getRoute(withStops)` (scoped reads)

**M4 — Draw, detour, prove it**
- [ ] #215 · MAPS 11 — route builder UI: pick addresses → save an ordered route 🔬
- [ ] #216 · MAPS 12 — draw the route + total distance/ETA (Directions API) 🔬🤝
- [ ] #217 · MAPS 13 — detour: insert/reorder a stop → redraw 🔬
- [ ] #218 · MAPS 14 — E2E: build a route + cross-org isolation over the wire 🤝

🔬 = map/UI spike (verify in the browser, not TDD) · 🤝 = pair on this seam

## Dependency graph (so two issues are almost always independently ready)
```
1 ─┬─ 4 ─ 6 ─┬─ 11 ─┐
   └─ 3 ─ 7  │      │
2 ─────┘     │      ├─ 12🤝 ─ 13 ─ 14🤝
5 ───────────┘      │
8 ─┬─ 9 ────────────┘
   └─ 10 ─── 12
```
Arrows = "must come after"; anything unconnected is independently ready.

## Rules
- **TDD on all backend** (tables/services/actions): failing test first, minimal code, commit. Map/UI tasks (🔬) are browser-verified spikes, not TDD.
- **One branch per issue (`maps/<#>-slug`) · one PR · no-squash merge** into the IAM-foundation branch.
- **Every tenant table ships with RLS + a cross-org isolation test** (HANDBOOK §6); every action gets `withPermission` + Zod.
- **Security invariants:** addresses/routes are org-scoped via `withOrgContext`; no `USING (true)` on a tenant table; the server key never reaches the browser.

## How @Vulturu1 + @penut101 work it (neither siloed)
- Both backend; **any issue, either person.** Take the two highest *ready* issues that don't touch the same files.
- **Pair on the 🤝 seams** — MAPS 12 (the Directions integration, the riskiest piece for backend-leaning devs) and MAPS 14 (the isolation proof).
- **Cross-review every PR** — the other approves; check the §6 list + "is there an isolation test?".

## Out of scope (the *next* project)
Route optimization (TSP/VRP), loading lists, manifests, driver/warehouse views, live tracking, auto-rerouting, and any orders integration.
