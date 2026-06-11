# Monolithic Docs Page with TOC Sidebar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the multi-page HTML docs (guide + 5 standalone feature pages + pill nav + in-place tabs) with one monolithic `add-a-feature.html` that has a fixed TOC sidebar, where each feature's docs are projected from doc comments in its `index.ts`.

**Architecture:** `scripts/generate-feature-surfaces.mjs` (zero-dependency, pure functions + thin fs `main()`) gains two parsers (full module doc comment → intro paragraphs; per-export doc comments → Description column) and two renderers (full inline feature sections; TOC sub-items), and loses the standalone-page machinery. The hand-authored page gets a docs shell: sidebar grid, TOC with a second generated-marker pair, scroll-spy. Spec: `docs/superpowers/specs/2026-06-11-monolithic-docs-page-design.md`.

**Tech Stack:** Node (ESM script, no deps), Vitest (`@vitest-environment node`), hand-authored HTML/CSS with design tokens (`tokens.css`/`base.css`).

**Verification commands** (used throughout):

```bash
npx vitest run scripts/generate-feature-surfaces.test.ts   # unit tests
npm run docs:surfaces                                      # regenerate
npm run lint && npx tsc --noEmit && npm test               # gates
```

---

### Task 1: `parseIndexDoc` — full module doc comment as paragraphs

Replaces `parseIndexDocLead` (first sentence only) with a function returning every paragraph of the leading `/** ... */`. `parseIndexDocLead` itself is deleted in Task 5 along with its only caller.

**Files:**
- Modify: `scripts/generate-feature-surfaces.mjs` (add function after `parseIndexDocLead`, ~line 80)
- Test: `scripts/generate-feature-surfaces.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the test file (after the `parseIndexDocLead` describe block) and add `parseIndexDoc` to the import list at the top:

```ts
describe('parseIndexDoc', () => {
  it('returns the whole module doc comment as paragraph strings', () => {
    const src = `/**
 * Notes dev API (Iron Rule 8) — the ONLY surface outsiders
 * may import.
 *
 * NOT exported on purpose: private plumbing and manifests.
 */
export { NotesLive } from './NotesLive';
`;
    expect(parseIndexDoc(src)).toEqual([
      'Notes dev API (Iron Rule 8) — the ONLY surface outsiders may import.',
      'NOT exported on purpose: private plumbing and manifests.',
    ]);
  });

  it('returns a single paragraph when the comment has no blank line', () => {
    expect(parseIndexDoc(INDEX_SOURCE)).toEqual([
      'Notes dev API (Iron Rule 8, ADR-0005).',
    ]);
  });

  it('returns [] when there is no module doc comment', () => {
    expect(parseIndexDoc("export { A } from './A';\n")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/generate-feature-surfaces.test.ts`
Expected: FAIL — `parseIndexDoc` is not exported (SyntaxError / undefined import).

- [ ] **Step 3: Write the implementation**

In `generate-feature-surfaces.mjs`, directly after `parseIndexDocLead`:

```js
/**
 * The full leading `/** ... *​/` doc comment as paragraph strings —
 * paragraphs are separated by blank comment lines. This is the feature's
 * contributor-authored intro prose on the docs page.
 */
export function parseIndexDoc(source) {
  const m = /^\s*\/\*\*([\s\S]*?)\*\//.exec(source);
  if (!m) return [];
  const lines = m[1].split('\n').map((l) => l.replace(/^\s*\*?\s?/, '').trim());
  const paragraphs = [];
  let current = [];
  for (const line of lines) {
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/generate-feature-surfaces.test.ts`
Expected: PASS (all, including the pre-existing suites).

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-feature-surfaces.mjs scripts/generate-feature-surfaces.test.ts
git commit -m "feat(docs-gen): parseIndexDoc returns full module doc comment as paragraphs"
```

---

### Task 2: `parseIndexExports` captures per-export descriptions

A `/** ... */` immediately above an `export { ... } from '...'` statement becomes that entry's `description`. The module-level comment (the file's first non-whitespace token) is never an export description. Every entry gains a `description` field (`''` when uncommented).

**Files:**
- Modify: `scripts/generate-feature-surfaces.mjs:27-40` (`parseIndexExports`)
- Test: `scripts/generate-feature-surfaces.test.ts`

- [ ] **Step 1: Write the failing tests**

Add a shared fixture near `INDEX_SOURCE` at the top of the test file:

```ts
const DOCUMENTED_SOURCE = `/**
 * Notes dev API (Iron Rule 8, ADR-0005).
 */
/** Live notes list, realtime-updating. */
export { NotesLive } from './NotesLive';
/** Server actions: read and create. */
export { getNotes, createNote } from './actions';
export type { NoteRow } from './actions';
`;
```

Add to the `parseIndexExports` describe block:

```ts
  it('captures a doc comment above an export as its description', () => {
    expect(parseIndexExports(DOCUMENTED_SOURCE)).toEqual([
      { name: 'NotesLive', from: './NotesLive', typeOnly: false,
        description: 'Live notes list, realtime-updating.' },
      { name: 'getNotes', from: './actions', typeOnly: false,
        description: 'Server actions: read and create.' },
      { name: 'createNote', from: './actions', typeOnly: false,
        description: 'Server actions: read and create.' },
      { name: 'NoteRow', from: './actions', typeOnly: true, description: '' },
    ]);
  });

  it('never mistakes the module doc comment for the first export description', () => {
    expect(parseIndexExports(INDEX_SOURCE)[0].description).toBe('');
  });
```

And update the existing first test's expectation — every entry gains `description: ''`:

```ts
    expect(parseIndexExports(INDEX_SOURCE)).toEqual([
      { name: 'NotesLive', from: './NotesLive', typeOnly: false, description: '' },
      { name: 'getNotes', from: './actions', typeOnly: false, description: '' },
      { name: 'createNote', from: './actions', typeOnly: false, description: '' },
      { name: 'NoteRow', from: './actions', typeOnly: true, description: '' },
    ]);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/generate-feature-surfaces.test.ts`
Expected: FAIL — entries have no `description` field.

- [ ] **Step 3: Update the implementation**

Replace the whole `parseIndexExports` function with:

```js
/**
 * Parse an index.ts source into its re-exported names.
 * Returns [{ name, from, typeOnly, description }] in source order, flattening
 * `export { a, b } from './x'` into one entry per name. A `/** ... *​/`
 * immediately above an export statement becomes its description (shared by
 * all names on that line); the module-level comment — the file's first
 * non-whitespace token — belongs to the feature (parseIndexDoc), never to
 * the export below it.
 */
export function parseIndexExports(source) {
  const out = [];
  const re =
    /(?:\/\*\*([\s\S]*?)\*\/[ \t]*\n\s*)?export\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const isModuleDoc =
      m[1] !== undefined && source.slice(0, m.index).trim() === '';
    const description =
      m[1] === undefined || isModuleDoc
        ? ''
        : m[1]
            .split('\n')
            .map((l) => l.replace(/^\s*\*?\s?/, '').trim())
            .filter(Boolean)
            .join(' ');
    const typeOnly = Boolean(m[2]);
    const from = m[4];
    for (const raw of m[3].split(',')) {
      const name = raw.trim().replace(/^type\s+/, '');
      if (name) out.push({ name, from, typeOnly, description });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/generate-feature-surfaces.test.ts`
Expected: PASS. (The `classifyFeatureFiles` suite checks only `.name`, so it is unaffected.)

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-feature-surfaces.mjs scripts/generate-feature-surfaces.test.ts
git commit -m "feat(docs-gen): per-export doc comments become export descriptions"
```

---

### Task 3: `injectBetweenMarkers` works with named marker pairs

The page now has two generated regions: `feature-surfaces` (sections) and `feature-toc` (sidebar sub-items). Generalize the marker constants into a name parameter; the default keeps today's behavior.

**Files:**
- Modify: `scripts/generate-feature-surfaces.mjs:18-20` (constants) and `:465-477` (`injectBetweenMarkers`)
- Test: `scripts/generate-feature-surfaces.test.ts` (`injectBetweenMarkers` describe block)

- [ ] **Step 1: Write the failing test**

Add to the `injectBetweenMarkers` describe block:

```ts
  it('injects into a named marker pair', () => {
    const page = [
      '<ul>',
      '<!-- BEGIN GENERATED feature-toc (npm run docs:surfaces) -->',
      '<li>stale</li>',
      '<!-- END GENERATED feature-toc -->',
      '</ul>',
    ].join('\n');
    const out = injectBetweenMarkers(page, '<li>fresh</li>', 'feature-toc');
    expect(out).toContain('<li>fresh</li>');
    expect(out).not.toContain('stale');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/generate-feature-surfaces.test.ts`
Expected: FAIL — the feature-surfaces markers are not found in that page (throws).

- [ ] **Step 3: Update the implementation**

Replace the `BEGIN`/`END` constants (keep `MANIFEST_FILES`) with:

```js
const markersFor = (name) => ({
  begin: `<!-- BEGIN GENERATED ${name} (npm run docs:surfaces) -->`,
  end: `<!-- END GENERATED ${name} -->`,
});
```

Replace `injectBetweenMarkers` with:

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/generate-feature-surfaces.test.ts`
Expected: PASS — including the two pre-existing injectBetweenMarkers tests (default name).

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-feature-surfaces.mjs scripts/generate-feature-surfaces.test.ts
git commit -m "feat(docs-gen): injectBetweenMarkers takes a marker-pair name"
```

---

### Task 4: `renderSurfacesHtml` renders full inline sections; new `renderTocHtml`

The tabs die. `renderSurfacesHtml` now emits one self-contained `<section class="featdoc" id="<feature>">` per feature: module-doc intro paragraphs, dev API table with a Description column, used-by, seams, and the verbatim contract in a collapsed `<details>`. `renderTocHtml` emits the sidebar's feature sub-items. Feature ids stay the bare names (`#notes`), so existing deep links keep working.

**Files:**
- Modify: `scripts/generate-feature-surfaces.mjs` — `devApiTableHtml` (~line 108), `renderSurfacesHtml` (~line 165); add `renderTocHtml`
- Test: `scripts/generate-feature-surfaces.test.ts` — delete the `renderSurfacesHtml — in-place feature tabs` describe block; add two new blocks

- [ ] **Step 1: Replace the old tab tests with failing section tests**

Delete the whole `describe('renderSurfacesHtml — in-place feature tabs', ...)` block. Add (uses `DOCUMENTED_SOURCE` from Task 2; add `renderTocHtml` to the imports):

```ts
describe('renderSurfacesHtml — inline feature sections', () => {
  const surfaces = [
    {
      feature: 'notes',
      indexSource: DOCUMENTED_SOURCE,
      publicExports: parseIndexExports(DOCUMENTED_SOURCE),
      manifests: ['schema.ts'],
      privateFiles: ['use-notes-realtime.ts'],
      usedBy: [
        { path: 'app/(dashboard)/notes/page.tsx', names: ['getNotes', 'NotesLive'] },
      ],
    },
    {
      feature: 'auth',
      indexSource: `/** Auth dev API. */\nexport { LoginForm } from './LoginForm';\n`,
      publicExports: [
        { name: 'LoginForm', from: './LoginForm', typeOnly: false, description: '' },
      ],
      manifests: [],
      privateFiles: [],
      usedBy: [],
    },
  ];

  it('renders one addressable section per feature, no tabs, no pill nav', () => {
    const html = renderSurfacesHtml(surfaces);
    expect(html.match(/class="featdoc"/g)).toHaveLength(2);
    expect(html).toContain('id="notes"');
    expect(html).toContain('id="auth"');
    expect(html).not.toContain('feattabs');
    expect(html).not.toContain('featnav');
    expect(html).not.toContain('featpanel');
  });

  it('renders the full module doc comment as the section intro', () => {
    expect(renderSurfacesHtml(surfaces)).toContain(
      'Notes dev API (Iron Rule 8, ADR-0005).',
    );
  });

  it('renders a Description column fed by per-export doc comments', () => {
    const html = renderSurfacesHtml(surfaces);
    expect(html).toContain('<th>Description</th>');
    expect(html).toContain('Live notes list, realtime-updating.');
    expect(html).toContain('Server actions: read and create.');
  });

  it('keeps the dev API essentials: exports, used-by, seams', () => {
    const html = renderSurfacesHtml(surfaces);
    expect(html).toContain('NotesLive');
    expect(html).toContain('app/(dashboard)/notes/page.tsx');
    expect(html).toContain('schema.ts');
    expect(html).toContain('use-notes-realtime.ts');
  });

  it('embeds the verbatim contract, highlighted, in a collapsed details', () => {
    const html = renderSurfacesHtml(surfaces);
    expect(html).toContain('<details class="contract">');
    expect(html).toContain('tok-k');
    expect(html).toContain("'./NotesLive'");
  });

  it('links to no standalone pages anywhere', () => {
    expect(renderSurfacesHtml(surfaces)).not.toContain('.html');
  });
});

describe('renderTocHtml', () => {
  it('renders one anchor sub-item per feature, in order', () => {
    const html = renderTocHtml(['auth', 'notes']);
    expect(html).toContain('href="#auth"');
    expect(html).toContain('href="#notes"');
    expect(html.indexOf('#auth')).toBeLessThan(html.indexOf('#notes'));
    expect(html).not.toContain('.html');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/generate-feature-surfaces.test.ts`
Expected: FAIL — `renderTocHtml` not exported; old `renderSurfacesHtml` emits feattabs markup.

- [ ] **Step 3: Update the renderers**

Replace `devApiTableHtml` with (adds the Description column):

```js
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
```

Replace `renderSurfacesHtml` (and its doc comment) with:

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/generate-feature-surfaces.test.ts`
Expected: PASS for all new blocks. The `renderFeaturePageHtml` suites still pass (untouched until Task 5).

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-feature-surfaces.mjs scripts/generate-feature-surfaces.test.ts
git commit -m "feat(docs-gen): inline feature sections + TOC fragment replace tabs"
```

---

### Task 5: Delete the standalone-page machinery; rewrite `main()`

Remove `renderFeaturePageHtml`, `renderFeatureNav`, `navItems`, `parseIndexDocLead`, their tests, the standalone write loop, and the generated pages directory. `main()` now performs two injections into one file.

**Files:**
- Modify: `scripts/generate-feature-surfaces.mjs`
- Modify: `scripts/generate-feature-surfaces.test.ts`
- Delete: `docs/html/features/` (5 generated pages)

- [ ] **Step 1: Delete dead tests**

In the test file, delete these describe blocks entirely:
- `describe('parseIndexDocLead', ...)`
- `describe('renderFeaturePageHtml', ...)`
- `describe('renderFeaturePageHtml — sparse features', ...)`

Remove `parseIndexDocLead` and `renderFeaturePageHtml` from the import list. Update the file-header comment's "rewrites the generated section" wording if it mentions standalone pages (it doesn't — leave it).

- [ ] **Step 2: Delete dead code and rewrite `main()`**

In `generate-feature-surfaces.mjs` delete:
- `parseIndexDocLead` (whole function)
- `renderFeatureNav` and `navItems`
- `renderFeaturePageHtml` (whole function, including its embedded page template)
- `mkdirSync` from the `node:fs` import (no longer used)

Update the file-header comment (lines 1–12) to:

```js
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
```

Replace `main()`'s tail (everything from `const page = readFileSync(pagePath, 'utf8');` to the `console.log`) with:

```js
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
```

(The `routeFiles` walk and `surfaces` construction are unchanged.)

- [ ] **Step 3: Remove the generated pages from the repo**

```bash
git rm -r docs/html/features
```

(`.DS_Store` inside it is untracked cruft; if `git rm` leaves the dir, `rm -rf docs/html/features` afterwards.)

- [ ] **Step 4: Run the tests**

Run: `npx vitest run scripts/generate-feature-surfaces.test.ts`
Expected: PASS — no references to deleted functions remain.

Do NOT run `npm run docs:surfaces` yet — the page gains its `feature-toc` markers in Task 6.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-feature-surfaces.mjs scripts/generate-feature-surfaces.test.ts
git commit -m "feat(docs-gen): single-page output — standalone feature pages removed"
```

---

### Task 6: Restructure `add-a-feature.html` into the docs shell

Hand-authored edits only (everything outside the generated markers): sidebar grid layout, TOC markup with the `feature-toc` marker pair, ids on the h2 sections, scroll-spy script, tab CSS/JS removed. The stale tab content between the `feature-surfaces` markers gets replaced by the generator in Task 7.

**Files:**
- Modify: `docs/html/add-a-feature.html`

- [ ] **Step 1: Replace the tab/pill CSS with shell CSS**

In the `<style>` block, delete these rule groups:
- `.featnav`, `.featnav-item`, `a.featnav-item:hover`, `.featnav-item.current`, `a.featnav-item.current:hover` (lines ~71–81)
- the whole in-place tabs block: comment + `.feattabs`, `.feattabs > .featnav`, `.featpanels`, `.featpanel`, `.featpanel + .featpanel`, `.feattabs.js-tabs .featpanel`, `.feattabs.js-tabs .featpanel.is-active`, `.feattabs.js-tabs .featpanel + .featpanel`, `.featpanel-title`, `.featpanel-label`, `.featpanel-more-row`, `.featpanel-more` (lines ~86–103)

Keep `.pill` (used by the generated tables). In their place add:

```css
  /* Docs shell: sticky TOC sidebar + content column. One page, no tabs. */
  html { scroll-behavior: smooth; }
  .layout { display: grid; grid-template-columns: 240px minmax(0, 1fr);
            gap: var(--space-12); max-width: var(--content-max);
            margin-inline: auto; padding-inline: var(--space-6); }
  .toc { position: sticky; top: 0; align-self: start; max-height: 100dvh;
         overflow-y: auto; padding-block: var(--space-16); }
  .toc-title { font-size: var(--text-xs); font-weight: 600;
               letter-spacing: .08em; text-transform: uppercase;
               color: var(--ink-muted); margin-bottom: var(--space-3); }
  .toc ul { list-style: none; padding: 0; margin: 0; }
  .toc li { max-width: none; }
  .toc li + li { margin-top: 0; }
  .toc a { display: block; font-size: var(--text-sm); color: var(--ink-muted);
           padding: var(--space-1) var(--space-3);
           border-left: 2px solid var(--hairline); }
  .toc a:hover { color: var(--ink); text-decoration: none; }
  .toc a.current { color: var(--accent); border-left-color: var(--accent);
                   font-weight: 600; }
  .toc ul ul { margin-left: var(--space-4); }
  section[id], .featdoc { scroll-margin-top: var(--space-6); }
  /* Generated per-feature sections */
  .featdoc { padding-block: 0; margin-top: var(--space-12); }
  .featdoc + .featdoc { border-top: 1px solid var(--hairline);
                        padding-top: var(--space-12); }
  .featdoc-title { margin-top: 0; font-size: var(--text-xl); }
  .featdoc-import { font-size: var(--text-sm); }
  .featdoc-label { margin-top: var(--space-6); margin-bottom: 0; }
  details.contract { margin-top: var(--space-6); }
  details.contract summary { cursor: pointer; font-size: var(--text-sm);
                             font-weight: 600; color: var(--accent); }
  details.contract .snippet { margin-top: var(--space-4); }
  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; gap: 0; }
    .toc { position: static; max-height: none;
           padding-block: var(--space-8) 0;
           border-bottom: 1px solid var(--hairline); }
  }
```

- [ ] **Step 2: Restructure the body into sidebar + main**

Immediately after `<body>` insert:

```html
<div class="layout">

<nav class="toc" aria-label="Table of contents">
  <p class="toc-title">On this page</p>
  <ul>
    <li><a href="#mental-model">The mental model</a></li>
    <li><a href="#contract">The dev API contract</a></li>
    <li><a href="#features">Feature surfaces</a>
      <ul>
<!-- BEGIN GENERATED feature-toc (npm run docs:surfaces) -->
<!-- END GENERATED feature-toc -->
      </ul>
    </li>
    <li><a href="#playbook">The playbook</a></li>
    <li><a href="#evolving">Evolving a dev API</a></li>
    <li><a href="#gates">The gates</a></li>
  </ul>
</nav>

<main>
```

Immediately before the first `<script>` tag insert:

```html
</main>

</div>
```

(The footer stays inside `<main>`, above `</main>`.)

- [ ] **Step 3: De-`wrap` and id the sections**

The grid column now provides centering and gutters, so `.wrap` goes away inside the layout; `.prose` stays. Make exactly these tag edits:

| Old opening tag | New opening tag |
|---|---|
| `<header class="hero wrap prose">` | `<header class="hero prose">` |
| `<section class="doc wrap prose">` + `<h2>The mental model</h2>` | `<section class="doc prose" id="mental-model">` |
| `<section class="doc wrap prose">` + `<h2>The dev API contract</h2>` | `<section class="doc prose" id="contract">` |
| `<section class="doc wrap prose">` + `<h2>Current feature surfaces</h2>` | `<section class="doc prose" id="features">` |
| `<section class="doc wrap prose">` + `<h2>The playbook</h2>` | `<section class="doc prose" id="playbook">` |
| `<section class="doc wrap prose">` + `<h2>Evolving a dev API</h2>` | `<section class="doc prose" id="evolving">` |
| `<section class="doc wrap prose">` + `<h2>The gates</h2>` | `<section class="doc prose" id="gates">` |
| `<div class="wrap prose">` (in footer) | `<div class="prose">` |

In the `#features` section, retitle `<h2>Current feature surfaces</h2>` to `<h2>Feature surfaces</h2>` and replace its intro `<p>` with:

```html
  <p>The complete dev API of the system today, projected from each feature's
  <code>index.ts</code> — the code is the source of truth, the sections below
  are generated from it (<code>npm run docs:surfaces</code>). Each feature
  documents itself in its index: the module doc comment becomes the intro,
  and a doc comment above an export becomes its Description.</p>
```

- [ ] **Step 4: Replace the tabs script with scroll-spy**

Delete the entire second `<script>` block (the one whose comment starts `/* In-place feature tabs.`). Keep the first (syntax highlighter — still used by the hand-authored snippets). In its place add:

```html
<script>
/* TOC scroll-spy. IntersectionObserver highlights the entry whose section is
   topmost in view. Progressive enhancement: without JS the TOC is a plain
   working anchor list — nothing is hidden or collapsed. */
(function () {
  const links = [...document.querySelectorAll('.toc a[href^="#"]')];
  const targets = links
    .map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1))))
    .filter(Boolean);
  if (!links.length || !targets.length) return;
  let current = null;
  function select(id) {
    if (id === current) return;
    current = id;
    for (const a of links) {
      const on = a.hash.slice(1) === id;
      a.classList.toggle('current', on);
      a.toggleAttribute('aria-current', on);
    }
  }
  const visible = new Set();
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries)
        e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id);
      for (const t of targets)
        if (visible.has(t.id)) return select(t.id);
    },
    { rootMargin: '0px 0px -55% 0px' },
  );
  targets.forEach((t) => io.observe(t));
})();
</script>
```

- [ ] **Step 5: Commit**

```bash
git add docs/html/add-a-feature.html
git commit -m "feat(docs): docs shell — sticky TOC sidebar, section anchors, scroll-spy; tabs removed"
```

---

### Task 7: Regenerate, verify idempotence, run the gates

**Files:**
- Modify (generated): `docs/html/add-a-feature.html`

- [ ] **Step 1: Regenerate**

```bash
npm run docs:surfaces
```

Expected output: `feature-surfaces: 5 feature sections + TOC in .../docs/html/add-a-feature.html`

- [ ] **Step 2: Inspect the result**

```bash
grep -c 'class="featdoc"' docs/html/add-a-feature.html   # expect 5
grep -c 'featpanel\|feattabs' docs/html/add-a-feature.html || true  # expect 0
grep -c 'features/.*\.html' docs/html/add-a-feature.html || true    # expect 0
```

Open `docs/html/add-a-feature.html` in a browser and check: sidebar present and sticky, TOC anchors land on sections, scroll-spy highlights, contract `<details>` toggles, no console errors, sensible at 700px width.

- [ ] **Step 3: Verify idempotence**

```bash
npm run docs:surfaces && git diff --stat docs/html/add-a-feature.html
```

Expected: no diff after the second run (the working-tree diff from Step 1 stays identical — run `git diff` once, regenerate, confirm `git diff` output is byte-identical, e.g. via `git diff | shasum` before and after).

- [ ] **Step 4: Run the gates**

```bash
npm run lint && npx tsc --noEmit && npm test
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add docs/html/add-a-feature.html
git commit -m "docs(html): regenerate — inline feature sections + TOC on the monolithic page"
```

---

### Task 8: Design polish pass

One `/design` render→screenshot→critique loop on the finished page, per the spec ("sparingly" — polish only, not structure).

- [ ] **Step 1: Invoke the design skill** on `docs/html/add-a-feature.html`: render in a browser, screenshot at desktop (1440px) and narrow (700px) widths, critique against the existing token system (spacing rhythm, sidebar typography, table density, `<details>` affordance), apply only CSS-level fixes in the hand-authored `<style>` block. Structural changes are out of scope.

- [ ] **Step 2: Re-run the gates and the generator idempotence check** (CSS edits must not touch generated regions):

```bash
npm run docs:surfaces && git status --short docs/html/add-a-feature.html
npm run lint && npm test
```

- [ ] **Step 3: Commit**

```bash
git add docs/html/add-a-feature.html
git commit -m "docs(html): design polish pass on the monolithic docs page"
```
