// Feature-surfaces docs generator.
//
// Reads each feature's index.ts — the dev API (Iron Rule 8, ADR-0005) — and
// rewrites the generated section of docs/html/add-a-feature.html between the
// BEGIN/END markers, so the "current feature set and their APIs" table can
// never drift from the code: the index files ARE the source of truth and this
// script is a projection of them.
//
//   npm run docs:surfaces
//
// Zero dependencies. Pure functions are unit-tested in
// generate-feature-surfaces.test.ts; main() is a thin fs shell around them.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST_FILES = ['nav.ts', 'permissions.ts', 'schema.ts'];
const BEGIN = '<!-- BEGIN GENERATED feature-surfaces (npm run docs:surfaces) -->';
const END = '<!-- END GENERATED feature-surfaces -->';

/**
 * Parse an index.ts source into its re-exported names.
 * Returns [{ name, from, typeOnly }] in source order, flattening
 * `export { a, b } from './x'` into one entry per name.
 */
export function parseIndexExports(source) {
  const out = [];
  const re = /export\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const typeOnly = Boolean(m[1]);
    const from = m[3];
    for (const raw of m[2].split(',')) {
      const name = raw.trim().replace(/^type\s+/, '');
      if (name) out.push({ name, from, typeOnly });
    }
  }
  return out;
}

/**
 * Classify a feature folder's files against its index source:
 *   publicExports — what the index re-exports (the dev API)
 *   manifests     — schema/permissions/nav present (the registry seam)
 *   privateFiles  — non-test sources neither referenced by the index nor
 *                   manifests: provably unreachable from outside the feature.
 */
export function classifyFeatureFiles(files, indexSource) {
  const publicExports = parseIndexExports(indexSource);
  const referenced = new Set(
    publicExports.map((e) => e.from.replace(/^\.\//, '')),
  );
  const manifests = files.filter((f) => MANIFEST_FILES.includes(f)).sort();
  const privateFiles = files
    .filter((f) => !/\.test\.tsx?$/.test(f))
    .filter((f) => f !== 'index.ts' && !MANIFEST_FILES.includes(f))
    .filter((f) => !referenced.has(f.replace(/\.tsx?$/, '')))
    .sort();
  return { publicExports, manifests, privateFiles };
}

const escapeHtml = (t) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Render the surfaces table. One row per feature: dev API exports (grouped
 * by source module), manifests, private internals.
 */
export function renderSurfacesHtml(surfaces) {
  const rows = surfaces
    .map((s) => {
      const exports =
        s.publicExports
          .map(
            (e) =>
              `<code>${escapeHtml(e.name)}</code>${e.typeOnly ? ' <em>(type)</em>' : ''}`,
          )
          .join(', ') || '<span class="muted">—</span>';
      const manifests =
        s.manifests.map((f) => `<code>${escapeHtml(f)}</code>`).join(' · ') ||
        '<span class="muted">—</span>';
      const privates =
        s.privateFiles.map((f) => `<code>${escapeHtml(f)}</code>`).join(' · ') ||
        '<span class="muted">—</span>';
      return [
        '    <tr>',
        `      <td><strong>${escapeHtml(s.feature)}</strong></td>`,
        `      <td>${exports}</td>`,
        `      <td>${manifests}</td>`,
        `      <td>${privates}</td>`,
        '    </tr>',
      ].join('\n');
    })
    .join('\n');
  return [
    '  <div class="table-scroll"><table>',
    '    <tr><th>Feature</th><th>Dev API (<code>index.ts</code> exports)</th><th>Manifests (registry seam)</th><th>Private internals</th></tr>',
    rows,
    '  </table></div>',
  ].join('\n');
}

/** Replace the content between the BEGIN/END markers, keeping the markers. */
export function injectBetweenMarkers(html, generated) {
  const begin = html.indexOf(BEGIN);
  const end = html.indexOf(END);
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(
      `Generated-section markers not found; expected "${BEGIN}" before "${END}"`,
    );
  }
  return (
    html.slice(0, begin + BEGIN.length) + '\n' + generated + '\n' + html.slice(end)
  );
}

function main() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const featuresRoot = join(repoRoot, 'app', '_features');
  const pagePath = join(repoRoot, 'docs', 'html', 'add-a-feature.html');

  const surfaces = readdirSync(featuresRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((feature) => {
      const dir = join(featuresRoot, feature);
      const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f));
      const indexSource = files.includes('index.ts')
        ? readFileSync(join(dir, 'index.ts'), 'utf8')
        : '';
      return { feature, ...classifyFeatureFiles(files, indexSource) };
    });

  const page = readFileSync(pagePath, 'utf8');
  writeFileSync(pagePath, injectBetweenMarkers(page, renderSurfacesHtml(surfaces)));
  console.log(
    `feature-surfaces: wrote ${surfaces.length} features into ${pagePath}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
