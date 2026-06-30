// NotesLive island (app/_features/notes/NotesLive).
//
// jsdom (vitest default here). The island is a thin presenter over
// `useNotesRealtime`: it owns the empty-state vs. table rendering and nothing
// else, so we hoist-mock the hook to return a fixed row set and assert ONLY the
// view. (Subscription + merge behaviour is covered by use-notes-realtime.test.)
//
// Auto-cleanup is off (vitest `globals` disabled), so we `cleanup` after each.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

  it('labels the caller\'s own notes "You" and others by a short id (not a raw UUID)', () => {
    hookRows = [
      {
        id: 'b',
        createdBy: 'abcdef12-3456-7890-aaaa-bbbbbbbbbbbb',
        body: 'theirs',
        createdAt: '2026-02-02T00:00:00.000Z',
      },
      { id: 'a', createdBy: 'u1', body: 'mine', createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    render(<NotesLive userId="u1" initial={hookRows} timezone="UTC" hour12={false} />);

    const rows = screen.getAllByTestId('note-row');
    expect(rows[1]).toHaveTextContent('You'); // createdBy === userId
    expect(rows[0]).toHaveTextContent('abcdef12'); // others → short id
    expect(rows[0]).not.toHaveTextContent('abcdef12-3456'); // never the full UUID
    expect(rows[0]).not.toHaveTextContent('You');
  });

  it('opens the clicked note in the inspector with a download action', () => {
    hookRows = [
      { id: 'b', createdBy: 'u2', body: 'second note body', createdAt: '2026-02-02T00:00:00.000Z' },
      { id: 'a', createdBy: 'u1', body: 'first note body', createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    render(<NotesLive userId="u1" initial={hookRows} timezone="UTC" hour12={false} />);

    fireEvent.click(screen.getAllByTestId('note-row')[1]); // the 'first note body' row
    const inspector = screen.getByTestId('note-inspector');
    expect(inspector).toHaveTextContent('first note body');
    expect(within(inspector).getByRole('button', { name: /download \.txt/i })).toBeInTheDocument();
  });

  it('filters the table to a chosen author via the facet', () => {
    hookRows = [
      { id: 'b', createdBy: 'u2', body: 'theirs', createdAt: '2026-02-02T00:00:00.000Z' },
      { id: 'a', createdBy: 'u1', body: 'mine', createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    render(<NotesLive userId="u1" initial={hookRows} timezone="UTC" hour12={false} />);

    fireEvent.click(screen.getByRole('button', { name: /filter by u2/i }));
    const rows = screen.getAllByTestId('note-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('theirs');
  });

  it('filters by a search query over the note body', () => {
    hookRows = [
      { id: 'b', createdBy: 'u1', body: 'reefer temperature ok', createdAt: '2026-02-02T00:00:00.000Z' },
      { id: 'a', createdBy: 'u1', body: 'dock door audit', createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    render(<NotesLive userId="u1" initial={hookRows} timezone="UTC" hour12={false} />);

    fireEvent.change(screen.getByRole('searchbox', { name: /search notes/i }), {
      target: { value: 'reefer' },
    });
    const rows = screen.getAllByTestId('note-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('reefer temperature ok');
  });
});
