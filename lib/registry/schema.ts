// Schema composition root (Domain Charter §3) — the sanctioned bridge that lets
// the foundation's Drizzle client see feature-owned tables WITHOUT `lib/db`
// importing `app/` directly. `lib/db/schema/index.ts` re-exports this file; this
// file re-exports each feature's `schema` manifest. The import-boundary law
// permits exactly this hop: `lib/db` -> `lib/registry` is intra-lib (legal), and
// `lib/registry` -> feature `schema` is the Rule-C exemption (registry may
// import feature manifests named schema/permissions/nav). Routing through here
// keeps `lib/db` free of any `app/` edge (Rule A).
//
// Until a feature adds a line below, this file contributes no tables. Removing a
// feature is one deleted line here — the foundation stays green.

export * from '@/app/_features/notes/schema';
export * from '@/app/_features/maps/schema';
// This keeps customer tables visible to Drizzle.
export * from '@/app/customer/memberships';
export * from '@/app/customer/organizations';
