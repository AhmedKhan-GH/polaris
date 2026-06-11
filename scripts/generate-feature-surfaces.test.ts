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
  injectBetweenMarkers,
  parseIndexExports,
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
