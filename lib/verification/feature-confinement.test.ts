// @vitest-environment node
//
// Feature-confinement law (Domain Charter §4 — the disposable exemplar).
//
// `notes` is the copy-paste TEMPLATE feature: it must be deletable in a single
// sweep, leaving the foundation fully green. That promise only holds if every
// reference to the exemplar lives inside a known, finite footprint — its own
// feature folder, the three composition-root registries, its migrations, its
// E2E specs, and the two verification controls that document its wiring. If a
// reference leaks anywhere else (a foundation module reaching for the exemplar
// "for inspiration", a stray import, a hard-coded `notes` table name), the
// feature is no longer confined and deleting it would break the trunk.
//
// This test walks all tracked source in the repo's first-party scope and fails
// if any NON-allowlisted file references the exemplar. It is the continuous,
// machine-checked counterpart to the one-time deletion rehearsal recorded in
// docs/adr/0004-fresh-derivation.md.
//
// Why content-scan and not import-graph: the exemplar leaks through more than
// imports — SQL table/policy names, broadcast topic strings, GoTrue TRUNCATE
// statements, CASL subjects. The import-boundary scanner (import-boundaries.
// test.ts) only sees `import`/`export` edges, so it cannot see those. Hence a
// precise IDENTIFIER content scan here.
//
// PRECISION (Charter §4 caveat): a naive /\bnotes?\b/i would trip on prose like
// "Note:" or "the notes page". The patterns below are deliberately specific —
// the singular `note` never matches; only the plural table/feature token
// `\bnotes\b`, the `_features/notes` import segment, the named exemplar
// identifiers, and the CASL `Note` subject (quoted) do. This was verified by
// construction against the whole tree: the word `notes` (any case) appears ONLY
// in exemplar-coupled files plus the two generic topic-grammar fixtures noted
// in the allowlist — there is zero prose contamination.

import { type Dirent, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, posix, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '..', '..');

/**
 * First-party source roots to scan, relative to the repo root. Scope is the
 * repo's own ts/tsx/sql/yml; vendored, generated, and prose trees are skipped
 * (see SKIP_DIRS + SCANNED_EXTENSIONS). `.github/` carries CI yml; the four
 * root config files are picked up by the root-level walk.
 */
const SCAN_ROOTS = ['app', 'lib', 'drizzle', 'e2e', '.github'];

/** Directory names never descended into, anywhere in the tree. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'docs',
]);

/** Repo-relative POSIX dir prefixes that are skipped (finer than a bare name). */
const SKIP_PREFIXES = ['supabase/.temp'];

/** Extensions in scope. JSON (incl. drizzle/meta snapshots) is out of scope. */
const SCANNED_EXTENSIONS = /\.(ts|tsx|sql|yml|yaml)$/;

/**
 * Files at the repo root that are configuration in scope (the "root configs"
 * of the spec). Planning `*.md` at root is excluded by extension already; we
 * additionally only scan the root level for these explicit config names rather
 * than walking the whole root (which would re-enter SCAN_ROOTS).
 */
const ROOT_CONFIG_FILES = [
  'drizzle.config.ts',
  'next.config.ts',
  'playwright.config.ts',
  'vitest.config.ts',
  'vitest.config.mts',
  'vitest.integration.config.mts',
  'eslint.config.mjs',
  'eslint.config.ts',
  'postcss.config.mjs',
  'tailwind.config.ts',
];

// --- tree walk (provenance: adapted from the ~20-line collector in
// lib/verification/import-boundaries.test.ts — test files must not import each
// other (Charter test-isolation), so the helper is COPIED here, not shared).
// Divergence from the original: this walk also accepts .sql/.yml/.yaml, honours
// SKIP_PREFIXES, and returns repo-relative POSIX paths directly. ---

/** Convert an absolute or OS-specific path to a repo-relative POSIX path. */
function toRepoRelPosix(absPath: string): string {
  return relative(REPO_ROOT, absPath).split(sep).join(posix.sep);
}

/** True when a repo-relative POSIX path sits under a skipped prefix. */
function isSkippedPrefix(relPosix: string): boolean {
  return SKIP_PREFIXES.some(
    (p) => relPosix === p || relPosix.startsWith(`${p}/`),
  );
}

/** Recursively collect in-scope source files under `absDir`, skipping junk. */
function collectSourceFiles(absDir: string): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return []; // root may not exist yet (e.g. an empty .github)
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const abs = join(absDir, entry.name);
    const relPosix = toRepoRelPosix(abs);
    if (isSkippedPrefix(relPosix)) continue;
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(abs));
    } else if (entry.isFile() && SCANNED_EXTENSIONS.test(entry.name)) {
      files.push(abs);
    }
  }
  return files;
}

/** Build the full set of in-scope source files (roots + named root configs). */
function collectAllSources(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (abs: string): void => {
    if (seen.has(abs)) return;
    seen.add(abs);
    out.push(abs);
  };
  for (const root of SCAN_ROOTS) {
    for (const abs of collectSourceFiles(join(REPO_ROOT, root))) add(abs);
  }
  for (const name of ROOT_CONFIG_FILES) {
    const abs = join(REPO_ROOT, name);
    try {
      if (readdirSync(REPO_ROOT).includes(name)) add(abs);
    } catch {
      /* ignore */
    }
  }
  return out;
}

// --- the exemplar-reference patterns -------------------------------------
//
// Each entry is [name, regex]. The scan reports the FIRST pattern a file
// matches, so `offenders` reads `file -> pattern`. Order is most-informative-
// first. `\bnotes\b` subsumes the `'notes'`/`"notes"`/`` `notes` `` string
// literal AND the bare SQL table token (e.g. `TRUNCATE notes`); we keep the
// import-path segment and the named identifiers separate so a leak is reported
// with the specific construct it leaked through. Case-sensitive where it
// matters: the singular CASL subject is matched only when quoted (`'Note'` /
// `"Note"`) so the English word "Note" in prose cannot trip it.

interface Pattern {
  readonly name: string;
  readonly re: RegExp;
}

const EXEMPLAR_PATTERNS: readonly Pattern[] = [
  { name: '_features/notes import segment', re: /_features\/notes\b/ },
  { name: 'notesAbilities identifier', re: /\bnotesAbilities\b/ },
  { name: 'notesNav identifier', re: /\bnotesNav\b/ },
  { name: 'notesWriteLimiter identifier', re: /\bnotesWriteLimiter\b/ },
  { name: 'useNotesRealtime identifier', re: /\buseNotesRealtime\b/ },
  { name: 'NotesLive identifier', re: /\bNotesLive\b/ },
  { name: 'broadcast_notes_change identifier', re: /\bbroadcast_notes_change\b/ },
  { name: 'notes_broadcast trigger', re: /\bnotes_broadcast\b/ },
  { name: 'notes_owner_or_self policy', re: /\bnotes_owner_or_self\b/ },
  { name: 'notes_read_own_topic policy', re: /\bnotes_read_own_topic\b/ },
  { name: 'NoteRow type', re: /\bNoteRow\b/ },
  { name: `quoted CASL subject 'Note'`, re: /['"]Note['"]/ },
  // Broad-but-safe catch-all: the plural table/feature/topic token, any case.
  // Verified by construction to add no prose false positives across the tree.
  { name: '`notes` table/feature/topic token', re: /\bnotes\b/i },
];

/** First exemplar pattern matched by `source`, or null when clean. */
function firstMatch(source: string): Pattern | null {
  for (const p of EXEMPLAR_PATTERNS) {
    if (p.re.test(source)) return p;
  }
  return null;
}

// --- allowlist: the sanctioned footprint of the exemplar ------------------
//
// EXACTLY the files permitted to reference `notes`. Anything else that matches
// a pattern above is a confinement breach. Kept as predicates so the feature
// folder can be matched by prefix and migrations by a glob-ish prefix.

/** Path is exactly `p` or sits under `p/` (POSIX, repo-relative). */
function isUnder(path: string, p: string): boolean {
  return path === p || path.startsWith(`${p}/`);
}

const ALLOWLIST: ReadonlyArray<(path: string) => boolean> = [
  // The exemplar's own feature folder — its entire body.
  (p) => isUnder(p, 'app/_features/notes'),
  // The dashboard route segment that renders it.
  (p) => p === 'app/(dashboard)/notes/page.tsx',
  // The three composition roots that wire it in (one deleted line each).
  (p) => p === 'lib/registry/abilities.ts',
  (p) => p === 'lib/registry/nav.ts',
  (p) => p === 'lib/registry/schema.ts',
  // Its migrations (table+RLS, realtime plumbing). drizzle/meta/* snapshots are
  // JSON (out of scan scope) but named here for the record; they carry the
  // migration tags and are deleted alongside 0003/0004.
  (p) => /^drizzle\/0003_.*\.sql$/.test(p),
  (p) => /^drizzle\/0004_.*\.sql$/.test(p),
  (p) => isUnder(p, 'drizzle/meta'),
  // Its E2E journeys.
  (p) => p === 'e2e/notes.spec.ts',
  (p) => p === 'e2e/realtime-notes.spec.ts',
  // Global E2E setup TRUNCATEs the exemplar table (one identifier on one line).
  (p) => p === 'e2e/global-setup.ts',
  // Registry-contents control: asserts the real registry composes the notes
  // contributor (`create Note`) — verification coupled to the exemplar's wiring.
  (p) => p === 'lib/permissions/ability.test.ts',
  // Migration-content control (Task 27): the M3 smoke describe-block asserts the
  // `notes` table/columns/policy materialise. It is exemplar-coupled VERIFICATION
  // and is deleted WITH the migrations (its notes describe-block is removed in
  // the rehearsal). Allowlisted on that basis — see ADR-0004's rehearsal record.
  (p) => p === 'lib/db/__tests__/migrations.integration.test.ts',
  // Foundation topic-grammar fixtures: these exercise the GENERIC realtime
  // primitives (`topicFor`/`topicAll`/`useTopic`) using 'notes' / 'notes:u1' as
  // an arbitrary example domain. They are NOT exemplar references — they survive
  // the feature's deletion verbatim (the rehearsal does not touch them). The
  // bare `'notes'` literal is the generic fixture value, not a coupling to the
  // notes feature. Allowlisted as known generic fixtures.
  (p) => p === 'lib/realtime/topics.test.ts',
  (p) => p === 'lib/realtime/use-topic.test.tsx',
  // This test itself names every pattern and path above.
  (p) => p === 'lib/verification/feature-confinement.test.ts',
];

function isAllowlisted(path: string): boolean {
  return ALLOWLIST.some((pred) => pred(path));
}

// --- the law -------------------------------------------------------------

describe('feature-confinement law (Charter §4: the disposable exemplar)', () => {
  it('confines every `notes` exemplar reference to its sanctioned footprint', () => {
    const offenders: string[] = [];
    for (const abs of collectAllSources()) {
      const rel = toRepoRelPosix(abs);
      if (isAllowlisted(rel)) continue;
      const hit = firstMatch(readFileSync(abs, 'utf8'));
      if (hit) offenders.push(`${rel} -> ${hit.name}`);
    }

    expect(
      offenders.length,
      'The `notes` exemplar must be deletable in one sweep (Charter §4); ' +
        'these files reference it OUTSIDE its sanctioned footprint:\n' +
        offenders.map((o) => `  ${o}`).join('\n'),
    ).toBe(0);
  });
});
