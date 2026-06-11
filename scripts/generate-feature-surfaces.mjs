// Feature-surfaces docs generator.
//
// Reads each feature's index.ts — the dev API (Iron Rule 8, ADR-0005) — and
// rewrites the two generated regions of docs/html/add-a-feature.html
// (feature sections + TOC sub-items) between BEGIN/END markers, so the docs
// can never drift from the code: the index files ARE the source of truth —
// module doc comment -> section intro, per-export doc comments ->
// Description column — and this script is a projection of them.
//
//   npm run docs:surfaces
//
// Zero dependencies. Pure functions are unit-tested in
// generate-feature-surfaces.test.ts; main() is a thin fs shell around them.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST_FILES = ['nav.ts', 'permissions.ts', 'schema.ts'];

const markersFor = (name) => ({
  begin: `<!-- BEGIN GENERATED ${name} (npm run docs:surfaces) -->`,
  end: `<!-- END GENERATED ${name} -->`,
});

/** Strip `/** ... *​/` syntax into trimmed text lines. */
const commentLines = (body) =>
  body.split('\n').map((l) => l.replace(/^\s*\*?\s?/, '').trim());

/**
 * Parse an index.ts source into its re-exported names.
 * Returns [{ name, from, typeOnly, description }] in source order, flattening
 * `export { a, b } from './x'` into one entry per name. A doc comment
 * immediately above an export statement becomes its description (shared by
 * all names on that line); the module-level comment — the file's first
 * non-whitespace token — belongs to the feature (parseIndexDoc), never to
 * the export below it.
 */
export function parseIndexExports(source) {
  const out = [];
  const re =
    /(?:\/\*\*((?:(?!\*\/)[\s\S])*)\*\/[ \t]*\n\s*)?export\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const isModuleDoc =
      m[1] !== undefined && source.slice(0, m.index).trim() === '';
    const description =
      m[1] === undefined || isModuleDoc
        ? ''
        : commentLines(m[1]).filter(Boolean).join(' ');
    const typeOnly = Boolean(m[2]);
    const from = m[4];
    for (const raw of m[3].split(',')) {
      const name = raw.trim().replace(/^type\s+/, '');
      if (name) out.push({ name, from, typeOnly, description });
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
 * The full leading `/** ... *​/` doc comment as paragraph strings —
 * paragraphs are separated by blank comment lines. This is the feature's
 * contributor-authored intro prose on the docs page.
 */
export function parseIndexDoc(source) {
  const m = /^\s*\/\*\*([\s\S]*?)\*\//.exec(source);
  if (!m) return [];
  const paragraphs = [];
  let current = [];
  for (const line of commentLines(m[1])) {
    if (line === '') {
      if (current.length) paragraphs.push(current.join(' '));
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) paragraphs.push(current.join(' '));
  return paragraphs;
}

/**
 * Shared surface fragments rendered into each feature's inline section.
 * Each returns a self-contained HTML block (or '' when empty).
 */
function devApiTableHtml(publicExports) {
  const rows = publicExports
    .map(
      (e) =>
        `      <tr><td><code>${escapeHtml(e.name)}</code></td><td><span class="pill">${exportKind(e)}</span></td><td>${escapeHtml(e.description ?? '')}</td><td><code>${escapeHtml(e.from)}</code></td></tr>`,
    )
    .join('\n');
  return [
    '  <table>',
    '    <tr><th>Export</th><th>Kind</th><th>Description</th><th>Source module</th></tr>',
    rows,
    '  </table>',
  ].join('\n');
}

function usedByTableHtml(usedBy) {
  if (!usedBy.length) return '';
  const rows = usedBy
    .map(
      (u) =>
        `      <tr><td><code>${escapeHtml(u.path)}</code></td><td>${u.names
          .map((n) => `<code>${escapeHtml(n)}</code>`)
          .join(', ')}</td></tr>`,
    )
    .join('\n');
  return [
    '  <table>',
    '    <tr><th>Importing file</th><th>Imports</th></tr>',
    rows,
    '  </table>',
  ].join('\n');
}

function seamsHtml(manifests, privateFiles) {
  const fileList = (files) =>
    files.map((f) => `<code>${escapeHtml(f)}</code>`).join(' · ');
  const parts = [];
  if (manifests.length)
    parts.push(
      `  <p><strong>Manifests</strong> (registry-only, rule C): ${fileList(manifests)}</p>`,
    );
  if (privateFiles.length)
    parts.push(
      `  <p><strong>Private internals</strong> (unreachable from outside): ${fileList(privateFiles)}</p>`,
    );
  return parts.join('\n');
}

/**
 * One full docs section per feature, rendered inline on the monolithic page:
 * contributor-authored intro (the index's module doc comment), the dev API
 * table (with per-export descriptions), used-by, seams, and the verbatim
 * contract in a collapsed <details>. Sections keep bare feature ids
 * (#notes) so old deep links and the TOC both land correctly.
 */
export function renderSurfacesHtml(surfaces) {
  return surfaces
    .map((s) => {
      const usedBy = s.usedBy ?? [];
      const doc = parseIndexDoc(s.indexSource ?? '');
      const parts = [
        `  <section class="featdoc" id="${escapeHtml(s.feature)}">`,
        `    <h3 class="featdoc-title">${escapeHtml(s.feature)}</h3>`,
        ...doc.map((p) => `    <p>${escapeHtml(p)}</p>`),
        `    <p class="muted featdoc-import">Import surface: <code>@/app/_features/${escapeHtml(s.feature)}</code> — everything else in the folder is private (rule&nbsp;D).</p>`,
        devApiTableHtml(s.publicExports),
      ];
      if (usedBy.length) {
        parts.push('    <p class="featdoc-label"><strong>Used by</strong></p>');
        parts.push(usedByTableHtml(usedBy));
      }
      const seams = seamsHtml(s.manifests, s.privateFiles);
      if (seams) {
        parts.push('    <p class="featdoc-label"><strong>Other seams</strong></p>');
        parts.push(seams);
      }
      parts.push(
        '    <details class="contract">',
        `      <summary>The contract, verbatim — <code>app/_features/${escapeHtml(s.feature)}/index.ts</code></summary>`,
        `      <figure class="snippet"><figcaption>app/_features/${escapeHtml(s.feature)}/index.ts</figcaption>`,
        `      <pre><code>${highlightTs((s.indexSource ?? '').trimEnd())}</code></pre></figure>`,
        '    </details>',
        '  </section>',
      );
      return parts.join('\n');
    })
    .join('\n');
}

/** The TOC sidebar's per-feature sub-items (anchors to the bare ids). */
export function renderTocHtml(features) {
  return features
    .map(
      (f) =>
        `          <li><a href="#${escapeHtml(f)}">${escapeHtml(f)}</a></li>`,
    )
    .join('\n');
}

/**
 * Generation-time TypeScript highlighter for the embedded contract — same
 * token classes and alternation order (comment > string > keyword > builtin
 * > call > Type) as the guide's in-page tokenizer, but run here so the
 * generated sections carry no client JS.
 */
const TS_TOKEN_RULES = [
  { re: String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`, c: 'c' },
  { re: String.raw`'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"`, c: 's' },
  {
    re: String.raw`\b(?:import|export|from|const|let|var|function|async|await|return|if|else|interface|new|default|extends|typeof|as|type|of|in|class)\b`,
    c: 'k',
  },
  { re: String.raw`\b(?:true|false|null|undefined)\b|\b\d[\d_]*\b`, c: 'n' },
  { re: String.raw`\b[A-Za-z_$][\w$]*(?=\s*\()`, c: 'f' },
  { re: String.raw`\b[A-Z][A-Za-z0-9_]*\b`, c: 't' },
];

export function highlightTs(source) {
  const re = new RegExp(TS_TOKEN_RULES.map((p) => `(${p.re})`).join('|'), 'g');
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(source)) !== null) {
    out += escapeHtml(source.slice(last, m.index));
    const gi = m.slice(1).findIndex((g) => g !== undefined);
    out += `<span class="tok-${TS_TOKEN_RULES[gi].c}">${escapeHtml(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + escapeHtml(source.slice(last));
}

/**
 * Find files that import a feature's dev API (the bare-folder specifier,
 * alias or relative) and which names they pull. Input: [{ path, source }].
 * Deep imports are not matched — rule D guarantees they don't exist.
 */
export function findImporters(files, feature) {
  const out = [];
  const spec = String.raw`(?:@\/app\/_features\/${feature}|(?:\.{1,2}\/)+_features\/${feature})`;
  const re = new RegExp(
    String.raw`import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]${spec}['"]`,
    'g',
  );
  for (const f of files) {
    const names = [];
    let m;
    while ((m = re.exec(f.source)) !== null) {
      for (const raw of m[1].split(',')) {
        const name = raw.trim().replace(/^type\s+/, '').replace(/\s+as\s+.*$/, '');
        if (name) names.push(name);
      }
    }
    if (names.length) out.push({ path: f.path, names });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Classify an export for the docs: type re-exports are types, anything from
 * an actions module is a server action, capitalized values are components,
 * the rest are plain functions.
 */
export function exportKind(entry) {
  if (entry.typeOnly) return 'type';
  if (/(^|\/)actions$/.test(entry.from)) return 'server action';
  if (/^[A-Z]/.test(entry.name)) return 'component';
  return 'function';
}

/** Replace the content between the named BEGIN/END markers, keeping them. */
export function injectBetweenMarkers(html, generated, name = 'feature-surfaces') {
  const { begin, end } = markersFor(name);
  const b = html.indexOf(begin);
  const e = html.indexOf(end);
  if (b === -1 || e === -1 || e < b) {
    throw new Error(
      `Generated-section markers not found; expected "${begin}" before "${end}"`,
    );
  }
  return html.slice(0, b + begin.length) + '\n' + generated + '\n' + html.slice(e);
}

function main() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const featuresRoot = join(repoRoot, 'app', '_features');
  const pagePath = join(repoRoot, 'docs', 'html', 'add-a-feature.html');

  // Route-tree sources (everything under app/ except _features) for Used-by.
  const routeFiles = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '_features') continue;
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (/\.tsx?$/.test(entry.name))
        routeFiles.push({
          path: abs.slice(repoRoot.length + 1).split(/\\/g).join('/'),
          source: readFileSync(abs, 'utf8'),
        });
    }
  })(join(repoRoot, 'app'));

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
      return {
        feature,
        indexSource,
        usedBy: findImporters(routeFiles, feature),
        ...classifyFeatureFiles(files, indexSource),
      };
    });

  const page = readFileSync(pagePath, 'utf8');
  const withSections = injectBetweenMarkers(page, renderSurfacesHtml(surfaces));
  writeFileSync(
    pagePath,
    injectBetweenMarkers(
      withSections,
      renderTocHtml(surfaces.map((s) => s.feature)),
      'feature-toc',
    ),
  );
  console.log(
    `feature-surfaces: ${surfaces.length} feature sections + TOC in ${pagePath}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
