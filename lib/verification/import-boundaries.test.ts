// @vitest-environment node
//
// Import-boundary law (Domain Charter §1.1 and feature-isolation rules).
//
// This is hand-rolled verification infrastructure: it walks the source tree,
// extracts import specifiers with a regex, resolves them to repo-relative
// paths, and asserts the architectural import rules. No graph library is used.
//
// Rule A: a file under `lib/` (except `lib/registry/`) must not import anything
//         under `app/` — the foundation may not depend on the application.
// Rule B: a file under `app/_features/<a>/` must not import from
//         `app/_features/<b>/` when `a !== b`. Exactly one edge is sanctioned:
//         an importer under `app/_features/shell/` may import from
//         `app/_features/auth/` (the signOutAction edge).
// Rule C: a file under `lib/registry/` may import from `app/_features/*/` ONLY
//         when the imported module's basename is `schema`, `permissions`, or
//         `nav` (feature manifests only).
// Rule D: outsiders import a feature ONLY via its dev API — the bare folder
//         specifier (`@/app/_features/<name>`, which is `<name>/index.ts`) —
//         never a file inside it (Iron Rule 8, ADR-0005). Exemptions: imports
//         from inside the same feature, and registry -> manifest edges (rule
//         C's seam). The sanctioned shell -> auth edge (rule B) is NOT exempt
//         here: it must travel through auth's index like any outsider.

import { type Dirent, readdirSync, readFileSync } from 'node:fs';
import { join, dirname, relative, resolve, posix, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '..', '..');

/**
 * Roots to scan, relative to the repo root. May not all exist yet. `app` is
 * scanned WHOLE (not just `_features`): rule D regulates route files as
 * importers, so pages/layouts must appear in the edge set.
 */
const SCAN_ROOTS = ['lib', 'app'];

/** A single resolved import edge, in repo-relative POSIX form. */
interface ImportEdge {
  /** Importing file, repo-relative, POSIX separators (e.g. `lib/foo.ts`). */
  importer: string;
  /** Raw specifier as written in source (e.g. `@/app/page`, `../bar`). */
  specifier: string;
  /**
   * Resolved target, repo-relative, POSIX separators, when the specifier
   * points inside the repo (via `@/` or a relative path). `null` for bare
   * package specifiers and anything resolving outside the repo — those can
   * never reference `app/` or a sibling feature, so rules ignore them.
   */
  target: string | null;
}

/** Convert an absolute or OS-specific path to a repo-relative POSIX path. */
function toRepoRelPosix(absPath: string): string {
  return relative(REPO_ROOT, absPath).split(sep).join(posix.sep);
}

/** Recursively collect `*.ts`/`*.tsx` files under `absDir`, skipping node_modules. */
function collectSourceFiles(absDir: string): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(absDir, { withFileTypes: true });
  } catch {
    // Directory does not exist yet (e.g. app/_features). Handle gracefully.
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue;
    const abs = join(absDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(abs));
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      files.push(abs);
    }
  }
  return files;
}

/**
 * Extract import specifiers from source text. Covers:
 *   import ... from '<spec>'
 *   export ... from '<spec>'
 *   import('<spec>')        (dynamic)
 * Type-only distinction is intentionally ignored. Single, double, and
 * backtick (no-substitution) quotes are accepted.
 */
function extractSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const q = `['"\`]`; // opening/closing quote char class
  const patterns = [
    // static import / export ... from '<spec>'
    new RegExp(`(?:^|[^.\\w])(?:import|export)\\b[^;'"\`]*?\\bfrom\\s*${q}([^'"\`]+)${q}`, 'g'),
    // bare side-effect import '<spec>'
    new RegExp(`(?:^|[^.\\w])import\\s*${q}([^'"\`]+)${q}`, 'g'),
    // dynamic import('<spec>')
    new RegExp(`\\bimport\\s*\\(\\s*${q}([^'"\`]+)${q}\\s*\\)`, 'g'),
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      specs.push(m[1]);
    }
  }
  return specs;
}

/**
 * Resolve a specifier to a repo-relative POSIX path, or `null` if it does not
 * point inside the repo (bare packages, paths escaping the root).
 *   `@/x/y`     -> repo root + `x/y`
 *   `./x`,`../x`-> resolved against the importer's directory
 *   `pkg`/`@scope/pkg` -> null (external)
 */
function resolveSpecifier(importerAbs: string, specifier: string): string | null {
  let targetAbs: string;
  if (specifier === '@' || specifier.startsWith('@/')) {
    targetAbs = join(REPO_ROOT, specifier.slice(specifier.indexOf('/') + 1));
  } else if (specifier.startsWith('.')) {
    targetAbs = resolve(dirname(importerAbs), specifier);
  } else {
    return null; // bare package specifier
  }
  const rel = relative(REPO_ROOT, targetAbs);
  if (rel.startsWith('..') || resolve(REPO_ROOT, rel) !== targetAbs) {
    return null; // escapes repo root
  }
  return rel.split(sep).join(posix.sep);
}

/** Build the full set of resolved import edges across all scan roots. */
function buildEdges(): ImportEdge[] {
  const edges: ImportEdge[] = [];
  const seenFiles = new Set<string>();
  for (const root of SCAN_ROOTS) {
    for (const fileAbs of collectSourceFiles(join(REPO_ROOT, root))) {
      if (seenFiles.has(fileAbs)) continue; // de-dupe overlapping roots
      seenFiles.add(fileAbs);
      const importer = toRepoRelPosix(fileAbs);
      const source = readFileSync(fileAbs, 'utf8');
      for (const specifier of extractSpecifiers(source)) {
        edges.push({
          importer,
          specifier,
          target: resolveSpecifier(fileAbs, specifier),
        });
      }
    }
  }
  return edges;
}

/** Basename of a specifier with any single trailing extension stripped. */
function specifierBasename(specifier: string): string {
  const last = specifier.split('/').pop() ?? specifier;
  return last.replace(/\.[^.]+$/, '');
}

/** Path is under `dir/` (POSIX, repo-relative). */
function isUnder(path: string, dir: string): boolean {
  return path === dir || path.startsWith(`${dir}/`);
}

/** Extract the `<name>` from `app/_features/<name>/...`, or null. */
function featureOf(path: string): string | null {
  const m = /^app\/_features\/([^/]+)\//.exec(path);
  return m ? m[1] : null;
}

const FEATURES_ROOT = 'app/_features';
const REGISTRY_ROOT = 'lib/registry';
const MANIFEST_BASENAMES = new Set(['schema', 'permissions', 'nav']);

/** Format violations as `importer -> specifier (rule X)` lines. */
function formatViolations(rule: string, edges: ImportEdge[]): string {
  return edges
    .map((e) => `  ${e.importer} -> ${e.specifier} (rule ${rule})`)
    .join('\n');
}

const ALL_EDGES = buildEdges();

describe('import-boundary law', () => {
  it('Rule A: lib/ (except lib/registry/) must not import from app/', () => {
    const violations = ALL_EDGES.filter((e) => {
      if (!isUnder(e.importer, 'lib')) return false;
      if (isUnder(e.importer, REGISTRY_ROOT)) return false; // registry exempt
      return e.target !== null && isUnder(e.target, 'app');
    });
    expect(
      violations.length,
      `Foundation must not import features (Charter §1.1):\n${formatViolations('A', violations)}`,
    ).toBe(0);
  });

  it('Rule B: a feature must not import from another feature (except shell -> auth)', () => {
    const violations = ALL_EDGES.filter((e) => {
      const fromFeature = featureOf(e.importer);
      if (fromFeature === null) return false; // importer not in a feature
      if (e.target === null || !isUnder(e.target, FEATURES_ROOT)) return false;
      const toFeature = featureOf(`${e.target}/`);
      if (toFeature === null || toFeature === fromFeature) return false; // intra-feature ok
      // The single sanctioned cross-feature edge: shell -> auth.
      if (fromFeature === 'shell' && toFeature === 'auth') return false;
      return true;
    });
    expect(
      violations.length,
      `Cross-feature imports are forbidden (only shell -> auth allowed):\n${formatViolations('B', violations)}`,
    ).toBe(0);
  });

  it('Rule C: lib/registry/ may import features only via schema/permissions/nav manifests', () => {
    const violations = ALL_EDGES.filter((e) => {
      if (!isUnder(e.importer, REGISTRY_ROOT)) return false;
      if (e.target === null || !isUnder(e.target, FEATURES_ROOT)) return false;
      return !MANIFEST_BASENAMES.has(specifierBasename(e.specifier));
    });
    expect(
      violations.length,
      `Registry may import only feature manifests (schema/permissions/nav):\n${formatViolations('C', violations)}`,
    ).toBe(0);
  });

  it("Rule D: outsiders import a feature only via its dev API (the feature's index)", () => {
    const violations = ALL_EDGES.filter((e) => {
      if (e.target === null || !isUnder(e.target, FEATURES_ROOT)) return false;
      const toFeature = featureOf(`${e.target}/`);
      if (toFeature === null) return false; // the _features root itself
      if (featureOf(e.importer) === toFeature) return false; // intra-feature ok
      // Registry -> manifest is rule C's seam, not the dev API.
      if (
        isUnder(e.importer, REGISTRY_ROOT) &&
        MANIFEST_BASENAMES.has(specifierBasename(e.specifier))
      ) {
        return false;
      }
      // The bare feature folder IS the index import — the dev API.
      if (e.target === `${FEATURES_ROOT}/${toFeature}`) return false;
      return true;
    });
    expect(
      violations.length,
      `Outsiders import a feature only via its index.ts dev API (Iron Rule 8, ADR-0005):\n${formatViolations('D', violations)}`,
    ).toBe(0);
  });
});
