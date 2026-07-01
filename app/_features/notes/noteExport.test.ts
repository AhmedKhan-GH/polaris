import { describe, expect, it } from 'vitest';

import { noteToMarkdown } from './noteExport';

describe('noteToMarkdown', () => {
  it('builds a .md filename and renders the title as an H1 above the body', () => {
    const { filename, text } = noteToMarkdown({
      id: 'abcdef12-3456-7890-aaaa-bbbbbbbbbbbb',
      title: 'Reefer R-07 log',
      body: '- holding **−18.2°C**',
    });

    expect(filename).toBe('note-abcdef12.md');
    expect(text.startsWith('# Reefer R-07 log')).toBe(true);
    expect(text).toContain('- holding **−18.2°C**'); // markdown body preserved verbatim
  });

  it('falls back to an "Untitled note" heading when the title is blank', () => {
    expect(noteToMarkdown({ id: 'x', title: '  ', body: 'b' }).text.startsWith('# Untitled note')).toBe(true);
  });
});
