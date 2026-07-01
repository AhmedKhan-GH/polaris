import Link from 'next/link';

import { formatTimestamp } from '@/lib/datetime';

import { createNote, saveNote, type NoteRow, type NoteVersionRow } from './actions';
import { DownloadNote } from './DownloadNote';

/** First non-empty line of a body — the nav/history fallback when there's no title. */
function firstLine(body: string): string {
  return body.split('\n').find((l) => l.trim().length > 0)?.trim() ?? '';
}

/** Display label for a note/version: its title, else the first body line, else "Untitled". */
function labelFor(title: string, body: string): string {
  return title.trim() || firstLine(body) || 'Untitled note';
}

/** Author display: the caller's own notes read "You"; others a short id (never a raw UUID). */
function authorLabel(id: string, currentUserId: string): string {
  return id === currentUserId ? 'You' : id.slice(0, 8);
}

/**
 * The Notes editor — a three-pane document surface: note navigation (left), the
 * editor (center), and version history (right). Server-rendered and URL-driven:
 * `?note=` selects a note; `?v=` loads a past version into the center pane as a
 * READ-ONLY view (older versions aren't editable — Save always appends from the
 * current). New/Save post server actions; the only client island is `.txt` download.
 */
export function NotesEditor({
  notes,
  selectedId,
  history,
  viewedVersionId,
  currentUserId,
  timezone,
  hour12,
}: {
  notes: NoteRow[];
  selectedId: string | null;
  history: NoteVersionRow[];
  viewedVersionId: string | null;
  currentUserId: string;
  timezone: string;
  hour12: boolean;
}) {
  const selected = notes.find((n) => n.id === selectedId) ?? null;
  // Versions are ordered newest-first; the first is the current one. `seq` stays
  // internal (ordering + data) — the UI never shows it.
  const currentId = history[0]?.id ?? null;
  // The version being VIEWED read-only: only when `?v=` names a non-current version.
  const viewed =
    viewedVersionId && viewedVersionId !== currentId
      ? (history.find((h) => h.id === viewedVersionId) ?? null)
      : null;
  // Which history row is highlighted: the viewed one, else the current (edit mode).
  const activeVersionId = viewed?.id ?? currentId;
  const when = (d: Date) => formatTimestamp(d.getTime(), timezone, hour12);

  return (
    <div className="grid grid-cols-1 border border-hairline bg-surface lg:h-[calc(100vh-12rem)] lg:grid-cols-[248px_1fr_296px]">
      {/* ── nav ── */}
      <aside className="flex min-h-0 flex-col border-b border-hairline lg:border-b-0 lg:border-r">
        <div className="shrink-0 border-b border-hairline p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <h1 className="font-serif text-lg font-semibold tracking-tight">Notes</h1>
            <span className="tnum text-xs text-ink-faint">{notes.length}</span>
          </div>
          <form action={createNote} className="flex gap-1.5">
            <input
              name="title"
              required
              aria-label="New note title"
              placeholder="New note…"
              className="h-8 min-w-0 flex-1 border border-hairline-strong bg-bg px-2.5 text-sm placeholder:text-ink-faint focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              className="h-8 shrink-0 bg-accent px-3 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
            >
              Add
            </button>
          </form>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto">
          {notes.length === 0 ? (
            <p data-testid="no-notes" className="p-4 text-sm text-ink-faint">
              No notes yet. Name your first above.
            </p>
          ) : (
            notes.map((n) => {
              const active = n.id === selectedId;
              return (
                <Link
                  key={n.id}
                  href={`/notes?note=${n.id}`}
                  aria-current={active ? 'page' : undefined}
                  className={`block border-b border-hairline px-3 py-2.5 ${
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

      {/* ── editor ── */}
      <section className="flex min-h-0 min-w-0 flex-col">
        {!selected ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <p className="max-w-xs text-sm text-ink-faint">
              Select a note on the left, or name a new one to begin.
            </p>
          </div>
        ) : viewed ? (
          /* read-only view of a past version */
          <>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-5 py-2.5">
              <p className="truncate text-xs text-ink-faint">
                {authorLabel(viewed.editedBy, currentUserId)} · saved{' '}
                <span className="font-mono">{when(viewed.createdAt)}</span>
              </p>
              <DownloadNote
                note={{
                  id: selected.id,
                  title: viewed.title,
                  createdBy: viewed.editedBy,
                  body: viewed.body,
                  createdAt: viewed.createdAt.toISOString(),
                }}
                timezone={timezone}
                hour12={hour12}
              />
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline bg-accent-soft px-5 py-2 text-xs">
              <span className="text-ink-muted">Viewing an earlier version — read-only.</span>
              <Link href={`/notes?note=${selected.id}`} className="font-medium text-accent-text hover:underline">
                Back to latest
              </Link>
            </div>
            <h2 className="shrink-0 border-b border-hairline px-5 py-3 font-serif text-xl font-semibold tracking-tight">
              {labelFor(viewed.title, viewed.body)}
            </h2>
            <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words px-5 py-4 text-sm leading-relaxed text-ink">
              {viewed.body}
            </div>
          </>
        ) : (
          /* editable current version */
          <>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-5 py-2.5">
              <p className="truncate text-xs text-ink-faint">
                {authorLabel(selected.createdBy, currentUserId)} · edited{' '}
                <span className="font-mono">{when(selected.createdAt)}</span>
              </p>
              <DownloadNote
                note={{
                  id: selected.id,
                  title: selected.title,
                  createdBy: selected.createdBy,
                  body: selected.body,
                  createdAt: selected.createdAt.toISOString(),
                }}
                timezone={timezone}
                hour12={hour12}
              />
            </div>
            <form action={saveNote} className="flex min-h-0 flex-1 flex-col">
              <input type="hidden" name="noteId" value={selected.id} />
              <input
                name="title"
                required
                defaultValue={selected.title}
                aria-label="Note title"
                placeholder="Untitled"
                className="shrink-0 border-b border-hairline bg-surface px-5 py-3 font-serif text-xl font-semibold tracking-tight text-ink placeholder:text-ink-faint focus:outline-none"
              />
              <textarea
                name="body"
                aria-label="Note body"
                defaultValue={selected.body}
                placeholder="Write…"
                className="min-h-0 flex-1 resize-none bg-surface px-5 py-4 text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none"
              />
              <div className="flex shrink-0 items-center justify-between border-t border-hairline px-5 py-2.5">
                <span className="text-xs text-ink-faint">Saving appends a new version.</span>
                <button
                  type="submit"
                  className="bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
                >
                  Save
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      {/* ── history ── */}
      <aside className="flex min-h-0 flex-col border-t border-hairline lg:border-l lg:border-t-0">
        <div className="flex shrink-0 items-baseline justify-between border-b border-hairline px-4 py-3">
          <span className="label text-ink-muted">History</span>
          <span className="tnum text-xs text-ink-faint">{history.length}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <p className="p-4 text-xs text-ink-faint">No versions to show.</p>
          ) : (
            history.map((v) => {
              const isCurrent = v.id === currentId;
              const isActive = v.id === activeVersionId;
              return (
                <Link
                  key={v.id}
                  href={`/notes?note=${selectedId}&v=${v.id}`}
                  aria-current={isActive ? 'true' : undefined}
                  className={`block border-b border-hairline px-4 py-3 ${
                    isActive
                      ? 'border-l-2 border-l-accent bg-accent-soft'
                      : 'border-l-2 border-l-transparent hover:bg-surface-alt'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="tnum truncate font-mono text-xs font-medium text-ink">
                      {when(v.createdAt)}
                    </span>
                    <span className="tnum shrink-0 font-mono text-xs text-ink-faint">
                      {v.body.length} chars
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-ink-muted">
                    {authorLabel(v.editedBy, currentUserId)} · {labelFor(v.title, v.body)}
                    {isCurrent && <span className="text-ink-faint"> · Current</span>}
                  </p>
                </Link>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
