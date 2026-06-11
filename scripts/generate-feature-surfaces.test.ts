// @vitest-environment node
//
// Unit contract for the feature-surfaces docs generator (scripts/). The
// generator reads each feature's index.ts (the dev API, Iron Rule 8) and
// rewrites the two generated regions of docs/html/add-a-feature.html
// (feature sections + TOC sub-items) between markers. Pure functions are
// tested here; the CLI shell around them is a thin readdir/readFile/
// writeFile pass.

import { describe, expect, it } from 'vitest';

import {
  classifyFeatureFiles,
  findImporters,
  injectBetweenMarkers,
  parseIndexDoc,
  parseIndexExports,
  renderSurfacesHtml,
  renderTocHtml,
} from './generate-feature-surfaces.mjs';

const INDEX_SOURCE = `/**
 * Notes dev API (Iron Rule 8, ADR-0005).
 */
export { NotesLive } from './NotesLive';
export { getNotes, createNote } from './actions';
export type { NoteRow } from './actions';
`;

const DOCUMENTED_SOURCE = `/**
 * Notes dev API (Iron Rule 8, ADR-0005).
 */
/** Live notes list, realtime-updating. */
export { NotesLive } from './NotesLive';
/** Server actions: read and create. */
export { getNotes, createNote } from './actions';
export type { NoteRow } from './actions';
`;

describe('parseIndexExports', () => {
  it('flattens multi-name export lines into {name, from} entries', () => {
    expect(parseIndexExports(INDEX_SOURCE)).toEqual([
      { name: 'NotesLive', from: './NotesLive', typeOnly: false, description: '' },
      { name: 'getNotes', from: './actions', typeOnly: false, description: '' },
      { name: 'createNote', from: './actions', typeOnly: false, description: '' },
      { name: 'NoteRow', from: './actions', typeOnly: true, description: '' },
    ]);
  });

  it('returns [] for an index with no re-exports', () => {
    expect(parseIndexExports('// nothing here\n')).toEqual([]);
  });

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
});

describe('classifyFeatureFiles', () => {
  const files = [
    'NotesLive.tsx',
    'NotesLive.test.tsx',
    'actions.ts',
    'actions.test.ts',
    'actions.integration.test.ts',
    'index.ts',
    'nav.ts',
    'nav.test.ts',
    'permissions.ts',
    'permissions.test.ts',
    'schema.ts',
    'use-notes-realtime.ts',
    'use-notes-realtime.test.tsx',
  ];

  it('splits files into public exports, manifests, and private internals', () => {
    const result = classifyFeatureFiles(files, INDEX_SOURCE);
    expect(result.publicExports.map((e) => e.name)).toEqual([
      'NotesLive',
      'getNotes',
      'createNote',
      'NoteRow',
    ]);
    expect(result.manifests).toEqual(['nav.ts', 'permissions.ts', 'schema.ts']);
    // Not referenced by the index, not a manifest, not a test: private.
    expect(result.privateFiles).toEqual(['use-notes-realtime.ts']);
  });

  it('reports no private files when the index references everything', () => {
    const result = classifyFeatureFiles(
      ['LoginForm.tsx', 'actions.ts', 'index.ts'],
      `export { LoginForm } from './LoginForm';\nexport { signOutAction } from './actions';\n`,
    );
    expect(result.privateFiles).toEqual([]);
  });
});

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

describe('findImporters', () => {
  const files = [
    {
      path: 'app/page.tsx',
      source: `import { LandingPage } from "./_features/landing";\nimport { PageHeader } from "./_features/shell";\n`,
    },
    {
      path: 'app/login/page.tsx',
      source: `import { LoginForm } from '@/app/_features/auth';\n`,
    },
  ];

  it('finds alias and relative bare-folder imports with their names', () => {
    expect(findImporters(files, 'landing')).toEqual([
      { path: 'app/page.tsx', names: ['LandingPage'] },
    ]);
    expect(findImporters(files, 'auth')).toEqual([
      { path: 'app/login/page.tsx', names: ['LoginForm'] },
    ]);
  });

  it('returns [] for a feature nobody imports', () => {
    expect(findImporters(files, 'activity')).toEqual([]);
  });
});

describe('injectBetweenMarkers', () => {
  const page = [
    '<p>before</p>',
    '<!-- BEGIN GENERATED feature-surfaces (npm run docs:surfaces) -->',
    '<p>stale</p>',
    '<!-- END GENERATED feature-surfaces -->',
    '<p>after</p>',
  ].join('\n');

  it('replaces only the content between the markers', () => {
    const out = injectBetweenMarkers(page, '<p>fresh</p>');
    expect(out).toContain('<p>before</p>');
    expect(out).toContain('<p>fresh</p>');
    expect(out).toContain('<p>after</p>');
    expect(out).not.toContain('<p>stale</p>');
  });

  it('injects into a named marker pair', () => {
    const tocPage = [
      '<ul>',
      '<!-- BEGIN GENERATED feature-toc (npm run docs:surfaces) -->',
      '<li>stale</li>',
      '<!-- END GENERATED feature-toc -->',
      '</ul>',
    ].join('\n');
    const out = injectBetweenMarkers(tocPage, '<li>fresh</li>', 'feature-toc');
    expect(out).toContain('<li>fresh</li>');
    expect(out).not.toContain('stale');
  });

  it('throws when the markers are missing', () => {
    expect(() => injectBetweenMarkers('<p>no markers</p>', 'x')).toThrow(
      /marker/i,
    );
  });
});
