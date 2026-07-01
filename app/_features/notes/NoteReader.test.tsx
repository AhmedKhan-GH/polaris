// jsdom (vitest default). A note with a blank body renders a deliberate empty
// state — an icon + "Empty note". That is the whole message: no explanatory
// sentence, which would itself read as note content. DownloadNote is stubbed;
// it has its own tests and is not the subject here.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./DownloadNote', () => ({ DownloadNote: () => null }));

import { NoteReader } from './NoteReader';

afterEach(cleanup);

const emptyNote = { id: 'n1', title: 'Just a title', body: '' };

describe('NoteReader empty state', () => {
  it('labels a body-less note as an empty state', () => {
    render(<NoteReader note={emptyNote} label="Just a title" author="You" when="2026-07-01" />);
    expect(screen.getByText('Empty note')).toBeInTheDocument();
  });

  it('adds no explanatory body copy — the icon and label carry it', () => {
    render(<NoteReader note={emptyNote} label="Just a title" author="You" when="2026-07-01" />);
    expect(screen.queryByText(/no body/i)).not.toBeInTheDocument();
  });
});
