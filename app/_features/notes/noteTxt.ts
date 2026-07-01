import { formatTimestamp } from '@/lib/datetime';

type NoteForTxt = {
  id: string;
  title: string;
  createdBy: string;
  body: string;
  createdAt: string;
};

/**
 * Render a note as a downloadable plain-text record. Pure (no DOM): the caller
 * turns `{ filename, text }` into a Blob download. The heading is the title (or
 * "Untitled note"); the timestamp is formatted through the shared formatter so
 * the file honors the reader's zone/clock; the filename is the short id.
 */
export function noteToTxt(
  note: NoteForTxt,
  timezone: string,
  hour12: boolean,
): { filename: string; text: string } {
  const when = formatTimestamp(new Date(note.createdAt).getTime(), timezone, hour12);
  const text = [
    note.title.trim() || 'Untitled note',
    `ID: ${note.id}`,
    `Author: ${note.createdBy}`,
    `Created: ${when}`,
    '',
    note.body,
    '',
  ].join('\n');
  return { filename: `note-${note.id.slice(0, 8)}.txt`, text };
}
