// NotesLive island (app/_features/notes/NotesLive).
//
// jsdom (vitest default here). The island is a thin presenter over
// `useNotesRealtime`: it owns the empty-state vs. table rendering and nothing
// else, so we hoist-mock the hook to return a fixed row set and assert ONLY the
// view. (Subscription + merge behaviour is covered by use-notes-realtime.test.)
//
// Auto-cleanup is off (vitest `globals` disabled), so we `cleanup` after each.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NoteRowView } from './use-notes-realtime';

// The island delegates to the hook for its rows; control them here.
let hookRows: NoteRowView[] = [];
vi.mock('./use-notes-realtime', () => ({
  useNotesRealtime: () => hookRows,
}));

import { NotesLive } from './NotesLive';

afterEach(cleanup);

describe('app/_features/notes NotesLive', () => {
  it('renders the empty-state paragraph when there are no rows', () => {
    hookRows = [];
    render(<NotesLive userId="u1" initial={[]} timezone="UTC" hour12={false} />);

    expect(screen.getByTestId('no-notes')).toHaveTextContent('No notes yet.');
    expect(screen.queryByTestId('note-row')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('renders one note-row per row with body text and no empty-state', () => {
    hookRows = [
      { id: 'b', createdBy: 'u2', body: 'second', createdAt: '2026-02-02T00:00:00.000Z' },
      { id: 'a', createdBy: 'u1', body: 'first', createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    render(<NotesLive userId="u1" initial={hookRows} timezone="UTC" hour12={true} />);

    expect(screen.queryByTestId('no-notes')).toBeNull();
    const rows = screen.getAllByTestId('note-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('second');
    expect(rows[1]).toHaveTextContent('first');
    // The When column formats createdAt through the shared formatter, honoring
    // the preferences passed in (here UTC + 12h) — proving the wiring, not raw ISO.
    expect(rows[1]).toHaveTextContent('2026-01-01 · 12:00:00 AM');
  });
});
