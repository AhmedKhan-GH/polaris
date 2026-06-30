'use client';

import { formatTimestamp } from '@/lib/datetime';

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
  timezone,
  hour12,
}: {
  userId: string;
  initial: NoteRowView[];
  timezone: string;
  hour12: boolean;
}) {
  const rows = useNotesRealtime(userId, initial);

  if (rows.length === 0) {
    return (
      <div
        data-testid="no-notes"
        className="border border-dashed border-hairline-strong bg-surface px-6 py-10 text-center text-sm text-ink-muted"
      >
        No notes yet. The first note your team adds appears here, live.
      </div>
    );
  }

  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-hairline-strong">
          <th className="py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Note
          </th>
          <th className="hidden py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-ink-faint sm:table-cell">
            Created by
          </th>
          <th className="py-3 pl-4 text-right text-xs font-semibold uppercase tracking-wider text-ink-faint">
            When
          </th>
        </tr>
      </thead>
      <tbody className="text-sm">
        {rows.map((row) => (
          <tr
            key={row.id}
            data-testid="note-row"
            className="border-b border-hairline transition-colors hover:bg-surface-alt"
          >
            <td className="py-4 pr-4">{row.body}</td>
            <td className="hidden py-4 pr-4 text-ink-muted sm:table-cell">{row.createdBy}</td>
            <td className="py-4 pl-4 text-right font-mono text-ink-muted">
              {formatTimestamp(new Date(row.createdAt).getTime(), timezone, hour12)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
