'use client';

import { useNotesRealtime, type NoteRowView } from './use-notes-realtime';

/**
 * The live notes list — a client island that seeds from the server-rendered
 * rows and then merges INSERT broadcasts via `useNotesRealtime` (the writer's
 * own new note, or any note when an owner watches the firehose-adjacent topic).
 *
 * Pure view: it renders the empty state or a table; all subscription/merge logic
 * lives in the hook. `createdAt` arrives as the serialized ISO string the page
 * produced from the server-side Date; we re-normalize through `new Date(...)
 * .toISOString()` so the rendered instant is canonical regardless of source.
 */
export function NotesLive({
  userId,
  initial,
}: {
  userId: string;
  initial: NoteRowView[];
}) {
  const rows = useNotesRealtime(userId, initial);

  if (rows.length === 0) {
    return <p data-testid="no-notes">No notes yet.</p>;
  }

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr>
          <th className="py-2 pr-4 font-medium">Note</th>
          <th className="py-2 pr-4 font-medium">Created by</th>
          <th className="py-2 pr-4 font-medium">When (UTC)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} data-testid="note-row">
            <td className="py-2 pr-4">{row.body}</td>
            <td className="py-2 pr-4">{row.createdBy}</td>
            <td className="py-2 pr-4">{new Date(row.createdAt).toISOString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
