import Link from 'next/link';

import { formatTimestamp } from '@/lib/datetime';

import { type NoteRow } from './actions';
import { DownloadNote } from './DownloadNote';
import { MarkdownBody } from './MarkdownBody';
import { NoteCreateForm } from './NoteCreateForm';

/** First non-empty line of a body — the nav fallback when there's no title. */
function firstLine(body: string): string {
  return body.split('\n').find((l) => l.trim().length > 0)?.trim() ?? '';
}

/** Display label: title, else the first body line, else "Untitled". */
function labelFor(title: string, body: string): string {
  return title.trim() || firstLine(body) || 'Untitled note';
}

/** Author display: the caller's own notes read "You"; others a short id (never a raw UUID). */
function authorLabel(id: string, currentUserId: string): string {
  return id === currentUserId ? 'You' : id.slice(0, 8);
}

/**
 * The Notes surface — a permanent left-hand list (nav) beside a reader. Notes are
 * immutable: the main pane either READS the selected note (title + body, no edit)
 * or, in create mode (`?new`), shows the one-shot create form. Server-rendered and
 * URL-driven (`?note=` selects, `?new=` creates); the only client island is `.txt`
 * download.
 */
export function NotesView({
  notes,
  selectedId,
  creating,
  currentUserId,
  timezone,
  hour12,
}: {
  notes: NoteRow[];
  selectedId: string | null;
  creating: boolean;
  currentUserId: string;
  timezone: string;
  hour12: boolean;
}) {
  const selected = notes.find((n) => n.id === selectedId) ?? null;
  const when = (d: Date) => formatTimestamp(d.getTime(), timezone, hour12);

  return (
    <div className="grid grid-cols-1 border border-hairline bg-surface sm:h-[calc(100vh-12rem)] sm:grid-cols-[260px_1fr]">
      {/* ── nav (permanent) ── */}
      <aside className="flex min-h-0 flex-col border-b border-hairline sm:border-b-0 sm:border-r">
        <div className="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-3">
          <div className="flex items-baseline gap-2">
            <h1 className="font-serif text-lg font-semibold tracking-tight">Notes</h1>
            <span className="tnum text-xs text-ink-faint">{notes.length}</span>
          </div>
          <Link
            href="/notes?new=1"
            className="bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
          >
            New
          </Link>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto">
          {notes.length === 0 ? (
            <p data-testid="no-notes" className="p-4 text-sm text-ink-faint">
              No notes yet. Create your first.
            </p>
          ) : (
            notes.map((n) => {
              const active = !creating && n.id === selectedId;
              return (
                <Link
                  key={n.id}
                  href={`/notes?note=${n.id}`}
                  aria-current={active ? 'page' : undefined}
                  className={`block border-b border-hairline px-4 py-2.5 ${
                    active
                      ? 'border-l-2 border-l-accent bg-accent-soft'
                      : 'border-l-2 border-l-transparent hover:bg-surface-alt'
                  }`}
                >
                  <p className="truncate text-sm font-medium">{labelFor(n.title, n.body)}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-faint">
                    {authorLabel(n.createdBy, currentUserId)} ·{' '}
                    <span className="font-mono">{when(n.createdAt)}</span>
                  </p>
                </Link>
              );
            })
          )}
        </nav>
      </aside>

      {/* ── main: create OR read ── */}
      <section className="flex min-h-0 min-w-0 flex-col">
        {creating ? (
          <NoteCreateForm />
        ) : selected ? (
          <>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-5 py-2.5">
              <p className="truncate text-xs text-ink-faint">
                {authorLabel(selected.createdBy, currentUserId)} ·{' '}
                <span className="font-mono">{when(selected.createdAt)}</span>
              </p>
              <DownloadNote note={{ id: selected.id, title: selected.title, body: selected.body }} />
            </div>
            <h2 className="shrink-0 border-b border-hairline px-5 py-3 font-serif text-xl font-semibold tracking-tight">
              {labelFor(selected.title, selected.body)}
            </h2>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {selected.body ? (
                <MarkdownBody>{selected.body}</MarkdownBody>
              ) : (
                <span className="text-sm text-ink-faint">No content.</span>
              )}
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <p className="max-w-xs text-sm text-ink-faint">
              Select a note on the left, or create a new one.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
