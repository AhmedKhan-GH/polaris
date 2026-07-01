'use client';

import { useState } from 'react';

import { DownloadNote } from './DownloadNote';
import { charCount, wordCount } from './wordStats';
import { MarkdownBody } from './MarkdownBody';

type View = 'source' | 'both' | 'read';

/** One key/value row in the properties panel. */
function Prop({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-4 py-2.5">
      <dt className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className={`mt-0.5 break-words text-xs text-ink ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}

/**
 * Read a saved (immutable) note: a header with a Read-only badge + view toggle +
 * download, the note title (styled like the create field, but static), the body
 * with a Source / Both / Read toggle, and a right-hand properties panel. An empty
 * note (title only) shows a dedicated empty state rather than placeholder text
 * that would read as content. There is no editing — notes are write-once.
 */
export function NoteReader({
  note,
  label,
  author,
  when,
}: {
  note: { id: string; title: string; body: string };
  label: string;
  author: string;
  when: string;
}) {
  const [view, setView] = useState<View>('read');
  const words = wordCount(note.body);
  const isEmpty = words === 0;

  const seg = (active: boolean) =>
    active
      ? 'px-2.5 py-1 font-medium bg-accent text-accent-fg'
      : 'px-2.5 py-1 text-ink-muted hover:text-ink';

  return (
    <>
      <div className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-hairline bg-surface-alt px-5">
        <span className="inline-flex shrink-0 items-center gap-1.5 border border-hairline-strong bg-surface px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
          <svg
            viewBox="0 0 16 16"
            className="size-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3.5" y="7" width="9" height="6" />
            <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" />
          </svg>
          Read-only
        </span>
        <div className="flex shrink-0 items-center gap-4">
          {!isEmpty && (
            <div className="flex border border-hairline-strong text-xs">
              <button type="button" onClick={() => setView('source')} className={seg(view === 'source')}>
                Source
              </button>
              <button
                type="button"
                onClick={() => setView('both')}
                className={`border-l border-hairline-strong ${seg(view === 'both')}`}
              >
                Split
              </button>
              <button
                type="button"
                onClick={() => setView('read')}
                className={`border-l border-hairline-strong ${seg(view === 'read')}`}
              >
                Read
              </button>
            </div>
          )}
          <DownloadNote note={note} />
        </div>
      </div>

      <h2 className="shrink-0 truncate border-b border-hairline bg-surface px-5 py-3 font-serif text-xl font-semibold tracking-tight text-ink">
        {label}
      </h2>

      <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[minmax(0,1fr)_12rem]">
        {/* document — or a dedicated empty state */}
        {isEmpty ? (
          <div className="grid min-h-0 place-items-center p-8">
            <div className="flex flex-col items-center gap-3 text-center text-ink-faint">
              <svg
                viewBox="0 0 24 24"
                className="size-9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 3h9l3 3v15H6z" />
                <path d="M15 3v3h3" />
              </svg>
              <p className="text-sm font-medium text-ink-muted">Empty note</p>
            </div>
          </div>
        ) : (
          <div className={`grid min-h-0 ${view === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {/* raw source */}
            <div
              className={`flex min-h-0 flex-col bg-surface-alt ${view === 'read' ? 'hidden' : ''} ${
                view === 'both' ? 'border-r border-hairline' : ''
              }`}
            >
              <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-5 py-4 font-mono text-sm leading-relaxed text-ink">
                {note.body}
              </pre>
            </div>
            {/* rendered */}
            <div className={`flex min-h-0 flex-col bg-surface ${view === 'source' ? 'hidden' : ''}`}>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <MarkdownBody>{note.body}</MarkdownBody>
              </div>
            </div>
          </div>
        )}

        {/* properties */}
        <aside className="flex min-h-0 flex-col overflow-y-auto border-t border-hairline bg-surface-alt sm:border-t-0 sm:border-l">
          <div className="shrink-0 border-b border-hairline px-4 py-2">
            <span className="text-[10px] uppercase tracking-wider text-ink-faint">Properties</span>
          </div>
          <dl className="divide-y divide-hairline">
            <Prop label="Author" value={author} />
            <Prop label="Created" value={when} mono />
            <Prop label="Words" value={String(words)} mono />
            <Prop label="Characters" value={String(charCount(note.body))} mono />
            <Prop label="ID" value={note.id} mono />
          </dl>
        </aside>
      </div>
    </>
  );
}
