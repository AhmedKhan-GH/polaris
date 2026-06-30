import { formatTimestamp } from '@/lib/datetime';

import type { NoteRowView } from './use-notes-realtime';

/**
 * Render a note as a downloadable plain-text record. Pure (no DOM): the caller
 * turns `{ filename, text }` into a Blob download. The timestamp is formatted
 * through the shared formatter so the file honors the reader's zone/clock, and
 * the filename is the short id — friendly, and stable per note.
 */
export function noteToTxt(
  note: NoteRowView,
  timezone: string,
  hour12: boolean,
): { filename: string; text: string } {
  const when = formatTimestamp(new Date(note.createdAt).getTime(), timezone, hour12);
  const text = [
    'Polaris — Note',
    `ID: ${note.id}`,
    `Author: ${note.createdBy}`,
    `Created: ${when}`,
    '',
    note.body,
    '',
  ].join('\n');
  return { filename: `note-${note.id.slice(0, 8)}.txt`, text };
}
