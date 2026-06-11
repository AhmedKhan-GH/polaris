// @vitest-environment node
//
// Unit contract for the feature-surfaces docs generator (scripts/). The
// generator reads each feature's index.ts (the dev API, Iron Rule 8) and
// rewrites the generated section of docs/html/add-a-feature.html between
// markers. Pure functions are tested here; the CLI shell around them is a
// thin readdir/readFile/writeFile pass.

import { describe, expect, it } from 'vitest';

import {
  classifyFeatureFiles,
  findImporters,
  injectBetweenMarkers,
  parseIndexDocLead,
  parseIndexExports,
  renderFeaturePageHtml,
  renderSurfacesHtml,
} from './generate-feature-surfaces.mjs';

const INDEX_SOURCE = `/**
 * Notes dev API (Iron Rule 8, ADR-0005).
 */
export { NotesLive } from './NotesLive';
export { getNotes, createNote } from './actions';
export type { NoteRow } from './actions';
`;

describe('parseIndexExports', () => {
  it('flattens multi-name export lines into {name, from} entries', () => {
    expect(parseIndexExports(INDEX_SOURCE)).toEqual([
      { name: 'NotesLive', from: './NotesLive', typeOnly: false },
      { name: 'getNotes', from: './actions', typeOnly: false },
      { name: 'createNote', from: './actions', typeOnly: false },
      { name: 'NoteRow', from: './actions', typeOnly: true },
    ]);
  });

  it('returns [] for an index with no re-exports', () => {
    expect(parseIndexExports('// nothing here\n')).toEqual([]);
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

describe('renderSurfacesHtml', () => {
  it('renders one row per feature with exports, manifests, and privates', () => {
    const html = renderSurfacesHtml([
      {
        feature: 'notes',
        publicExports: [
          { name: 'NotesLive', from: './NotesLive', typeOnly: false },
        ],
        manifests: ['schema.ts'],
        privateFiles: ['use-notes-realtime.ts'],
      },
    ]);
    expect(html).toContain('notes');
    expect(html).toContain('NotesLive');
    expect(html).toContain('schema.ts');
    expect(html).toContain('use-notes-realtime.ts');
  });

  it('links each feature name to its generated per-feature page', () => {
    const html = renderSurfacesHtml([
      {
        feature: 'notes',
        publicExports: [],
        manifests: [],
        privateFiles: [],
      },
    ]);
    expect(html).toContain('href="features/notes.html"');
  });
});

describe('parseIndexDocLead', () => {
  it('extracts the first line of the leading doc comment', () => {
    expect(parseIndexDocLead(INDEX_SOURCE)).toBe(
      'Notes dev API (Iron Rule 8, ADR-0005).',
    );
  });

  it('returns empty string when there is no doc comment', () => {
    expect(parseIndexDocLead("export { A } from './A';\n")).toBe('');
  });

  it('returns the whole first sentence even when it wraps across lines', () => {
    const src = `/**
 * Auth dev API — the ONLY surface outsiders
 * may import; deeper imports fail. Second sentence is dropped.
 */
export { LoginForm } from './LoginForm';
`;
    expect(parseIndexDocLead(src)).toBe(
      'Auth dev API — the ONLY surface outsiders may import; deeper imports fail.',
    );
  });
});

describe('renderFeaturePageHtml', () => {
  const surface = {
    feature: 'notes',
    publicExports: [
      { name: 'NotesLive', from: './NotesLive', typeOnly: false },
      { name: 'getNotes', from: './actions', typeOnly: false },
    ],
    manifests: ['schema.ts'],
    privateFiles: ['use-notes-realtime.ts'],
  };

  it('renders a complete standalone page for the feature', () => {
    const html = renderFeaturePageHtml(surface, INDEX_SOURCE);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<title>');
    expect(html).toContain('notes');
    expect(html).toContain('NotesLive');
    expect(html).toContain('./actions');
    expect(html).toContain('use-notes-realtime.ts');
    // The index source is embedded as the contract, highlighted at
    // generation time (no client JS in generated pages).
    expect(html).toContain('tok-k');
    expect(html).toContain("'./NotesLive'");
    // And it links back to the guide.
    expect(html).toContain('href="../add-a-feature.html"');
  });

  it('labels each export with its kind (component / server action / type)', () => {
    const html = renderFeaturePageHtml(surface, INDEX_SOURCE);
    // NotesLive: capitalized, .tsx-style component module -> component.
    expect(html).toMatch(/NotesLive[\s\S]*?component/);
    // getNotes comes from './actions' -> server action.
    expect(html).toMatch(/getNotes[\s\S]*?server action/);
  });

  it('is fully self-contained: inlines CSS, references no external stylesheets', () => {
    const html = renderFeaturePageHtml(surface, INDEX_SOURCE, [], {
      inlineCss: ':root{--accent:#0066CC}',
    });
    expect(html).not.toContain('<link rel="stylesheet"');
    expect(html).toContain(':root{--accent:#0066CC}');
  });

  it('cross-links sibling feature pages when given the full feature list', () => {
    const html = renderFeaturePageHtml(surface, INDEX_SOURCE, [
      'auth',
      'notes',
      'shell',
    ]);
    expect(html).toContain('href="auth.html"');
    expect(html).toContain('href="shell.html"');
    // The current feature is shown as the active item, not a self-link.
    expect(html).not.toContain('href="notes.html"');
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

describe('renderFeaturePageHtml — sparse features', () => {
  const sparse = {
    feature: 'landing',
    publicExports: [
      { name: 'LandingPage', from: './LandingPage', typeOnly: false },
    ],
    manifests: [],
    privateFiles: [],
    usedBy: [{ path: 'app/page.tsx', names: ['LandingPage'] }],
  };
  const src = `/** Landing dev API. */\nexport { LandingPage } from './LandingPage';\n`;

  it('omits the Other seams section when there is nothing to list', () => {
    const html = renderFeaturePageHtml(sparse, src);
    expect(html).not.toContain('Other seams');
  });

  it('never renders a zero stat card', () => {
    const html = renderFeaturePageHtml(sparse, src);
    expect(html).not.toMatch(/<h3>0<\/h3>/);
  });

  it('renders a Used by section naming each importing file', () => {
    const html = renderFeaturePageHtml(sparse, src);
    expect(html).toContain('Used by');
    expect(html).toContain('app/page.tsx');
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

  it('throws when the markers are missing', () => {
    expect(() => injectBetweenMarkers('<p>no markers</p>', 'x')).toThrow(
      /marker/i,
    );
  });
});
