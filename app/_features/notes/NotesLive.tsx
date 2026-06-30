'use client';

import { useMemo, useState } from 'react';

import { formatTimestamp } from '@/lib/datetime';

import { noteToTxt } from './noteTxt';
import { useNotesRealtime, type NoteRowView } from './use-notes-realtime';

/**
 * The live notes explorer — a client island that seeds from the server-rendered
 * rows and merges realtime INSERTs via `useNotesRealtime`, then lets the caller
 * thumb through, filter, open, and download notes. All interaction is client-side
 * over the already-loaded rows (no extra round-trips):
 *   • search (over the body) + an author facet narrow the table;
 *   • clicking a row OPENS it in the inspector;
 *   • the inspector downloads the note as a `.txt` (see `noteToTxt`).
 *
 * Pure view + local UI state; subscription/merge lives in the hook. Everything
 * derived (facet counts, the activity sparkbars) is computed from the row dates
 * themselves — never `Date.now()` — so SSR and hydration agree.
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
  const [query, setQuery] = useState('');
  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const authorLabel = (createdBy: string) => (createdBy === userId ? 'You' : createdBy.slice(0, 8));

  const authors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.createdBy, (counts.get(r.createdBy) ?? 0) + 1);
    return [...counts.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);
  const maxAuthor = authors[0]?.count ?? 1;

  const activity = useMemo(() => {
    const perDay = new Map<string, number>();
    for (const r of rows) {
      const day = r.createdAt.slice(0, 10);
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }
    const days = [...perDay.keys()].sort().slice(-14);
    const max = Math.max(1, ...days.map((d) => perDay.get(d) ?? 0));
    return {
      bars: days.map((d) => ({ d, h: Math.round(((perDay.get(d) ?? 0) / max) * 100) })),
      first: days[0],
      last: days[days.length - 1],
    };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <p data-testid="no-notes" className="border border-dashed border-hairline-strong px-5 py-8 text-sm text-ink-muted">
        No notes yet. The first note your team adds appears here, live.
      </p>
    );
  }

  const q = query.trim().toLowerCase();
  const filtered = rows.filter(
    (r) => (!authorFilter || r.createdBy === authorFilter) && (!q || r.body.toLowerCase().includes(q)),
  );
  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  const sameAuthor = selected ? rows.filter((r) => r.createdBy === selected.createdBy).length : 0;
  const sameDay = selected
    ? rows.filter((r) => r.createdAt.slice(0, 10) === selected.createdAt.slice(0, 10)).length
    : 0;

  return (
    <div className="flex flex-col border border-hairline lg:flex-row lg:items-stretch">
      {/* ── Filters ─────────────────────────────── */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-hairline bg-surface lg:flex">
        <p className="label border-b border-hairline px-4 py-2.5 text-ink-muted">Filters</p>
        <div className="border-b border-hairline px-4 py-3">
          <p className="label mb-2 text-ink-faint">Author</p>
          <div className="flex flex-col gap-1.5">
            {authors.map((a) => {
              const on = authorFilter === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={`Filter by ${authorLabel(a.id)}`}
                  onClick={() => setAuthorFilter(on ? null : a.id)}
                  className={`flex items-center gap-2 px-1 py-0.5 text-left text-sm ${on ? 'text-accent-text' : 'text-ink hover:text-ink'}`}
                >
                  <span className={`h-3 w-3 shrink-0 border ${on ? 'border-accent bg-accent' : 'border-hairline-strong'}`} />
                  <span className={a.id === userId ? '' : 'font-mono text-xs'}>{authorLabel(a.id)}</span>
                  <span className="tnum ml-auto w-6 text-right font-mono text-xs text-ink-muted">{a.count}</span>
                  <span className="h-1.5 w-9 bg-hairline">
                    <span className="block h-full bg-accent" style={{ width: `${Math.round((a.count / maxAuthor) * 100)}%` }} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="label mb-2 text-ink-faint">Activity</p>
          <div className="flex h-14 items-end gap-[3px]" aria-hidden="true">
            {activity.bars.map((b, i) => (
              <span key={b.d} className={`flex-1 ${i === activity.bars.length - 1 ? 'bg-accent' : 'bg-hairline-strong'}`} style={{ height: `${Math.max(6, b.h)}%` }} />
            ))}
          </div>
          {activity.first && (
            <div className="mt-1.5 flex justify-between font-mono text-[0.65rem] text-ink-faint">
              <span>{activity.first.slice(5)}</span>
              <span>{activity.last.slice(5)}</span>
            </div>
          )}
        </div>
      </aside>

      {/* ── Table ───────────────────────────────── */}
      <section className="flex min-w-0 flex-1 flex-col bg-surface">
        <div className="flex shrink-0 items-center gap-3 border-b border-hairline px-4 py-2">
          <div className="flex flex-1 items-center gap-2 border border-hairline-strong bg-bg px-2.5 py-1.5">
            <svg className="h-3.5 w-3.5 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
            <input
              type="search"
              aria-label="Search notes"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes…"
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
            />
          </div>
          <span className="tnum shrink-0 text-xs text-ink-faint">
            {filtered.length} of {rows.length}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-surface-alt">
              <tr className="border-b border-hairline-strong">
                <th className="label py-2 pl-5 pr-3 font-semibold text-ink-faint">Note</th>
                <th className="label hidden py-2 pr-3 font-semibold text-ink-faint sm:table-cell">Author</th>
                <th className="label py-2 pr-5 text-right font-semibold text-ink-faint">When</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filtered.map((row) => {
                const on = selected?.id === row.id;
                return (
                  <tr
                    key={row.id}
                    data-testid="note-row"
                    onClick={() => setSelectedId(row.id)}
                    className={`cursor-pointer ${on ? 'border-l-2 border-accent bg-accent-soft' : 'hover:bg-surface-alt'} [&>td]:border-b [&>td]:border-hairline`}
                  >
                    <td className={`py-2 pr-3 ${on ? 'pl-[18px]' : 'pl-5'}`}>{row.body}</td>
                    <td className="hidden py-2 pr-3 align-top sm:table-cell">
                      {row.createdBy === userId ? (
                        <span className="text-ink-muted">You</span>
                      ) : (
                        <span className="font-mono text-ink-faint">{row.createdBy.slice(0, 8)}</span>
                      )}
                    </td>
                    <td className="tnum py-2 pr-5 text-right align-top font-mono text-ink-muted">
                      {formatTimestamp(new Date(row.createdAt).getTime(), timezone, hour12)}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-sm text-ink-faint">
                    No notes match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Inspector ───────────────────────────── */}
      {selected && (
        <aside data-testid="note-inspector" className="flex w-full shrink-0 flex-col border-t border-hairline bg-surface lg:w-80 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
            <span className="label text-ink-muted">
              Note · <span className="font-mono normal-case tracking-normal text-ink-faint">{selected.id.slice(0, 8)}</span>
            </span>
          </div>
          <div className="border-b border-hairline px-4 py-4">
            <p className="text-base leading-relaxed">{selected.body}</p>
          </div>
          <dl className="grid grid-cols-2 gap-px border-b border-hairline bg-hairline">
            <div className="bg-surface px-4 py-2.5">
              <dt className="label text-ink-faint">Author</dt>
              <dd className="mt-1 text-sm">{selected.createdBy === userId ? 'You' : <span className="font-mono text-xs">{selected.createdBy.slice(0, 8)}</span>}</dd>
            </div>
            <div className="bg-surface px-4 py-2.5">
              <dt className="label text-ink-faint">Channel</dt>
              <dd className="mt-1 text-sm text-ink-muted">Team</dd>
            </div>
            <div className="col-span-2 bg-surface px-4 py-2.5">
              <dt className="label text-ink-faint">Created</dt>
              <dd className="mt-1 font-mono text-sm text-ink-muted">{formatTimestamp(new Date(selected.createdAt).getTime(), timezone, hour12)}</dd>
            </div>
          </dl>
          <div className="border-b border-hairline px-4 py-3">
            <p className="label mb-2 text-ink-faint">Context</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-muted">By this author</span><span className="tnum font-mono">{sameAuthor}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">On this day</span><span className="tnum font-mono">{sameDay}</span></div>
            </div>
          </div>
          <div className="flex gap-2 px-4 py-3">
            <button
              type="button"
              onClick={() => {
                const { filename, text } = noteToTxt(selected, timezone, hour12);
                downloadTextFile(filename, text);
              }}
              className="flex-1 bg-accent px-3 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
            >
              Download .txt
            </button>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(selected.body)}
              className="border border-hairline-strong px-3 py-2 text-sm text-ink-muted hover:text-ink"
            >
              Copy
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}

/** Client-only: save text as a downloaded file (Blob + transient anchor). */
function downloadTextFile(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
