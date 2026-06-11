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

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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
 * First line of the index's leading `/** ... *​/` doc comment, stripped of
 * comment syntax — used as the per-feature page lead.
 */
export function parseIndexDocLead(source) {
  const m = /^\s*\/\*\*([\s\S]*?)\*\//.exec(source);
  if (!m) return '';
  const text = m[1]
    .split('\n')
    .map((l) => l.replace(/^\s*\*?\s?/, '').trim())
    .filter((l) => l.length > 0)
    .join(' ');
  const sentence = /^.*?\.(?=\s|$)/.exec(text);
  return (sentence ? sentence[0] : text).trim();
}

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
        `      <td><strong><a href="features/${escapeHtml(s.feature)}.html">${escapeHtml(s.feature)}</a></strong></td>`,
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

/**
 * Generation-time TypeScript highlighter for the embedded contract — same
 * token classes and alternation order (comment > string > keyword > builtin
 * > call > Type) as the guide's in-page tokenizer, but run here so generated
 * pages carry no client JS.
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

/**
 * Render a standalone per-feature page: lead from the index doc comment,
 * at-a-glance cards, kind-labelled export table, manifests, private
 * internals, the index.ts source verbatim as the contract, and a pill nav
 * across sibling features. Mirrors the guide's look (same tokens/base CSS,
 * dark code figures) and links back to it.
 */
export function renderFeaturePageHtml(
  surface,
  indexSource,
  allFeatures = [],
  { inlineCss = '' } = {},
) {
  const { feature, publicExports, manifests, privateFiles, usedBy = [] } = surface;
  const lead = parseIndexDocLead(indexSource);
  const exportRows = publicExports
    .map(
      (e) =>
        `      <tr><td><code>${escapeHtml(e.name)}</code></td><td><span class="pill">${exportKind(e)}</span></td><td><code>${escapeHtml(e.from)}</code></td></tr>`,
    )
    .join('\n');
  const fileList = (files) =>
    files.map((f) => `<code>${escapeHtml(f)}</code>`).join(' · ');
  const featNav = allFeatures
    .map((f) =>
      f === feature
        ? `<span class="featnav-item current">${escapeHtml(f)}</span>`
        : `<a class="featnav-item" href="${escapeHtml(f)}.html">${escapeHtml(f)}</a>`,
    )
    .join('\n    ');

  // Stat cards adapt to the feature: zero counts are noise, not signal.
  const cards = [
    {
      n: publicExports.length,
      label: `public export${publicExports.length === 1 ? '' : 's'} — the entire dev API`,
    },
    { n: usedBy.length, label: `consumer${usedBy.length === 1 ? '' : 's'} in app routes` },
    { n: manifests.length, label: `manifest${manifests.length === 1 ? '' : 's'} on the registry seam` },
    {
      n: privateFiles.length,
      label: `private internal${privateFiles.length === 1 ? '' : 's'} — unreachable from outside`,
    },
  ]
    .filter((c) => c.n > 0)
    .map(
      (c) =>
        `    <div class="card"><h3>${c.n}</h3><p>${c.label}</p></div>`,
    )
    .join('\n');

  const usedByRows = usedBy
    .map(
      (u) =>
        `      <tr><td><code>${escapeHtml(u.path)}</code></td><td>${u.names
          .map((n) => `<code>${escapeHtml(n)}</code>`)
          .join(', ')}</td></tr>`,
    )
    .join('\n');
  const usedBySection = usedBy.length
    ? `
<section class="doc wrap prose">
  <h2>Used by</h2>
  <p>Every place in the app that consumes this dev API today — found by
  scanning the route tree's imports.</p>
  <table>
    <tr><th>Importing file</th><th>Imports</th></tr>
${usedByRows}
  </table>
</section>
`
    : '';

  const seamsParts = [];
  if (manifests.length)
    seamsParts.push(
      `  <p><strong>Manifests</strong> (registry-only, rule C): ${fileList(manifests)}</p>`,
    );
  if (privateFiles.length)
    seamsParts.push(
      `  <p><strong>Private internals</strong> (unreachable from outside): ${fileList(privateFiles)}</p>`,
    );
  const seamsSection = seamsParts.length
    ? `
<section class="doc wrap prose">
  <h2>Other seams</h2>
${seamsParts.join('\n')}
</section>
`
    : '';
  return `<!doctype html>
<!-- GENERATED by scripts/generate-feature-surfaces.mjs (npm run docs:surfaces) — do not hand-edit. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Polaris — ${escapeHtml(feature)} dev API</title>
<style>
/* Inlined design system (tokens.css + base.css) — generated pages are fully
   self-contained so they render identically from any location or server. */
${inlineCss}
</style>
<style>
  :root { --font-mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo,
                       Consolas, monospace;
          --code-bg: #0D1117; --code-bg-alt: #161B22;
          --code-ink: #E6EDF3; --code-muted: #8B949E; --code-line: #30363D; }
  .doc { padding-block: var(--space-12); }
  .doc + .doc { border-top: 1px solid var(--hairline); }
  .kicker { font-size: var(--text-sm); font-weight: 600; letter-spacing: .08em;
            text-transform: uppercase; color: var(--ink-muted); }
  code { font-family: var(--font-mono); font-size: 0.875em;
         background: var(--paper-alt); border-radius: 4px;
         padding: 1px var(--space-1); }
  pre  { font-family: var(--font-mono); font-size: var(--text-sm);
         line-height: 1.6; background: var(--code-bg); color: var(--code-ink);
         border: 1px solid var(--code-line); border-radius: var(--radius-card);
         padding: var(--space-4) var(--space-6); overflow-x: auto;
         margin-top: var(--space-4); }
  pre code { background: none; padding: 0; font-size: inherit; }
  figure.snippet { margin: var(--space-4) 0 0; }
  .snippet figcaption { font-family: var(--font-mono); font-size: var(--text-xs);
        color: var(--code-muted); background: var(--code-bg-alt);
        border: 1px solid var(--code-line); border-bottom: 0;
        border-radius: var(--radius-card) var(--radius-card) 0 0;
        padding: var(--space-2) var(--space-6); }
  .snippet pre { margin-top: 0; border-top: 1px solid var(--code-line);
        border-radius: 0 0 var(--radius-card) var(--radius-card); }
  .tok-c { color: var(--code-muted); font-style: italic; }
  .tok-k { color: #FF7B72; }
  .tok-s { color: #A5D6FF; }
  .tok-f { color: #D2A8FF; }
  .tok-t { color: #FFA657; }
  .tok-n { color: #79C0FF; }
  .doc h2 { margin-bottom: var(--space-4); }
  table { border-collapse: collapse; width: 100%; margin-top: var(--space-4);
          font-size: var(--text-sm); }
  th { text-align: left; font-weight: 600; padding: var(--space-2) var(--space-4)
       var(--space-2) 0; border-bottom: 1px solid var(--ink); }
  td { padding: var(--space-3) var(--space-4) var(--space-3) 0;
       border-bottom: 1px solid var(--hairline); vertical-align: top; }
  .hero { padding-block: var(--space-12) var(--space-8);
          border-bottom: 1px solid var(--hairline); }
  .featnav { display: flex; flex-wrap: wrap; gap: var(--space-2);
             margin-top: var(--space-6); }
  .featnav-item { display: inline-block; font-size: var(--text-sm);
       font-weight: 600; padding: var(--space-1) var(--space-4);
       border-radius: var(--radius-pill); border: 1px solid var(--hairline);
       color: var(--ink-muted); }
  a.featnav-item:hover { text-decoration: none; color: var(--ink);
       border-color: var(--ink-muted); }
  .featnav-item.current { background: var(--accent); color: var(--paper);
       border-color: var(--accent); }
  .glance { display: grid; gap: var(--space-6);
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            margin-top: var(--space-8); }
  .glance .card h3 { font-size: var(--text-2xl); font-weight: 700;
                     margin-bottom: var(--space-1); }
  .glance .card p { font-size: var(--text-sm); color: var(--ink-muted); }
  .pill { display: inline-block; font-size: var(--text-xs); font-weight: 600;
          padding: 2px var(--space-3); border-radius: var(--radius-pill);
          background: var(--paper-alt); border: 1px solid var(--hairline);
          color: var(--ink-muted); white-space: nowrap; }
  @media (max-width: 700px) { .glance { grid-template-columns: 1fr; } }
</style>
</head>
<body>

<header class="hero wrap prose">
  <p class="kicker"><a href="../add-a-feature.html">Polaris · Developer Handbook</a> · feature</p>
  <h1 style="font-size: var(--text-4xl); margin-top: var(--space-2)">${escapeHtml(feature)}</h1>
  <p class="lead">${escapeHtml(lead)}</p>
  <nav class="featnav" aria-label="Features">
    ${featNav}
  </nav>
</header>

<section class="doc wrap prose">
  <h2>At a glance</h2>
  <div class="glance">
${cards}
  </div>
  <p class="muted" style="font-size: var(--text-sm); margin-top: var(--space-6)">
  Generated from <code>app/_features/${escapeHtml(feature)}/index.ts</code> by
  <code>npm run docs:surfaces</code> — the code is the source of truth.</p>
</section>

<section class="doc wrap prose">
  <h2>Dev API</h2>
  <p>What outsiders may import from <code>@/app/_features/${escapeHtml(feature)}</code>.
  Everything else in the folder is private (boundary rule D).</p>
  <table>
    <tr><th>Export</th><th>Kind</th><th>Source module</th></tr>
${exportRows}
  </table>
</section>
${usedBySection}${seamsSection}

<section class="doc wrap prose">
  <h2>The contract, verbatim</h2>
  <figure class="snippet"><figcaption>app/_features/${escapeHtml(feature)}/index.ts</figcaption>
  <pre><code>${highlightTs(indexSource.trimEnd())}</code></pre></figure>
</section>

<footer>
  <div class="wrap prose">
    <a href="../add-a-feature.html">← Adding a feature &amp; integrating its dev API</a>
  </div>
</footer>

</body>
</html>
`;
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
  writeFileSync(pagePath, injectBetweenMarkers(page, renderSurfacesHtml(surfaces)));

  const featurePagesDir = join(repoRoot, 'docs', 'html', 'features');
  mkdirSync(featurePagesDir, { recursive: true });
  const featureNames = surfaces.map((s) => s.feature);
  const inlineCss = ['tokens.css', 'base.css']
    .map((f) => readFileSync(join(repoRoot, 'docs', 'html', f), 'utf8'))
    .join('\n');
  for (const s of surfaces) {
    writeFileSync(
      join(featurePagesDir, `${s.feature}.html`),
      renderFeaturePageHtml(s, s.indexSource, featureNames, { inlineCss }),
    );
  }
  console.log(
    `feature-surfaces: table in ${pagePath} + ${surfaces.length} pages in ${featurePagesDir}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
