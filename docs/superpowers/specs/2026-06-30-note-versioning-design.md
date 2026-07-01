# Notes — Document Versioning — Design

> **Status:** proposed (2026-06-30). Graduates `notes` from the Charter §4 *disposable
> exemplar* into a real, FK-able **backbone**: a note is an identity + metadata anchor with
> its content held as an append-only **version chain**. Sibling to
> `2026-06-30-event-log-design.md`; same ADR-0007 append-only discipline, but the *document*
> shape, not the *tracked-value* shape.

## Why notes are different from orders/prices

Order status and product price are **small scalars** — the live row is authoritative and the
event table is the interesting history (`order_events`, `product_price_events`). A note is the
opposite: **the content *is* the state**. A live `notes.body` plus full-copy events would store
the content twice. So notes use **document-versioning** — the note row holds *no* content; the
content lives entirely in an append-only version chain, and "current" is the latest version.

This is the same split Palantir uses: Ontology scalar edits are event-tracked, but **Notepad
documents are version snapshots** ([Notepad version history](https://www.palantir.com/docs/foundry/notepad/version-history)).

## Tables

```
notes                              -- identity + metadata ONLY. The stable FK target; metrics hang here.
  id          uuid pk default gen_random_uuid()
  created_by  uuid not null                        -- owning profile (mirrored; no FK to auth.users)
  created_at  timestamptz not null default now()
  state       note_state not null default 'active' -- lifecycle projection (active | archived); reversible   [PHASE 2]

note_versions                      -- the CONTENT, document-versioned. Append-only. This IS the note's body.
  id          uuid pk default gen_random_uuid()
  note_id     uuid not null references notes(id) on delete cascade
  seq         integer not null                     -- 1,2,3…; genesis = 1; latest seq = current
  body        text not null                        -- full snapshot at this version
  edited_by   uuid not null
  created_at  timestamptz not null default now()
  unique (note_id, seq)

note_status_events                 -- lifecycle transitions. Append-only. Mirrors product_status_events.   [PHASE 2]
  id          uuid pk default gen_random_uuid()
  note_id     uuid not null references notes(id) on delete cascade
  from_state  note_state                           -- NULL = creation (null → 'active')
  to_state    note_state not null
  actor_id    uuid not null
  occurred_at timestamptz not null default now()
```

`note_state` is a `text` column + CHECK `in ('active','archived')` — mirrors how `orders.status`
does its enum, not a `pgEnum` (keeps `db:generate` from re-emitting).

## Append-only enforcement (copy `notes` drizzle/0003 + `order_events`; hand-written in the migration)

- **`note_versions`, `note_status_events`** → `ENABLE RLS`; owner/ownership read policy (fails
  closed, reads the `app.user_*` GUCs); `GRANT SELECT, INSERT … TO app_user` — **no UPDATE/DELETE**.
  Immutability by grant, not convention.
- **`notes`** stays the one mutable table (state flips, future metrics): ownership RLS,
  `GRANT SELECT, INSERT, UPDATE` — **no DELETE** (archive, never hard-delete).

## Write path (ADR-0007 load → apply → save, one transaction each)

| Action | Effect (single txn) |
|---|---|
| `createNote(body)` | INSERT `notes` + `note_versions` (`seq 1`) [+ `note_status_events` `null→active` — phase 2] |
| `editNote(id, body)` | INSERT `note_versions` (`seq = max+1`) |
| `restoreVersion(id, seq)` | INSERT `note_versions` (`seq = max+1`, body = the chosen version's body) |
| `archiveNote(id)` / `restoreNote(id)` *(phase 2)* | UPDATE `notes.state` + INSERT `note_status_events` |

## Reads

- **Current body** = `note_versions` with max `seq` for the note.
- **List (nav)** = `notes` ⋈ latest version, newest-updated first, label = the body's first line.
- **History** = `note_versions` for a note, `seq` desc.
- **Timeline (later)** = `note_versions` `UNION ALL` `note_status_events` ordered by time.

## Authorization

CASL twin mirrors the RLS, both must pass (as today): `create Note` (unconditional; guard fails
closed), `read Note` (own rows; `owner` reads all), and a new **`update Note`** (own rows;
`owner` all) covering `editNote`/`restoreVersion` (and archive in phase 2).

## Migration (data-preserving)

Existing `notes` rows carry a `body`. The migration: create `note_versions`; **backfill** one
version per existing note (`seq 1`, `body`, `edited_by = created_by`, `created_at`); then **drop
`notes.body`**; add the append-only policy/grant. No note loses content.

## Phasing

- **Phase 1 (floor, this work):** `notes` (content dropped) + `note_versions`; `createNote` /
  `editNote` / `restoreVersion` / `getNotes`; the 3-pane editor (nav · edit · history).
- **Phase 2:** `state` + `note_status_events` + `archiveNote`/`restoreNote`; unified timeline;
  metrics columns; external FKs (`… references notes(id)`).
