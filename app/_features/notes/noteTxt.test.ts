import { describe, expect, it } from 'vitest';

import { noteToTxt } from './noteTxt';

describe('noteToTxt', () => {
  it('builds a friendly filename and a readable text record honoring preferences', () => {
    const { filename, text } = noteToTxt(
      {
        id: 'abcdef12-3456-7890-aaaa-bbbbbbbbbbbb',
        createdBy: 'u1',
        body: 'Reefer R-07 holding −18.2°C, within spec.',
        createdAt: '2026-06-30T22:00:14.000Z',
      },
      'UTC',
      false,
    );

    expect(filename).toBe('note-abcdef12.txt');
    expect(text).toContain('Reefer R-07 holding −18.2°C, within spec.');
    expect(text).toContain('ID: abcdef12-3456-7890-aaaa-bbbbbbbbbbbb');
    expect(text).toContain('Author: u1');
    expect(text).toMatch(/Created: 2026-06-30/); // formatted through the shared formatter
  });
});
