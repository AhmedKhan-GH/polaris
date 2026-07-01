'use client';

import { useState } from 'react';

import { DownloadNote } from './DownloadNote';
import { MarkdownBody } from './MarkdownBody';

type View = 'source' | 'both' | 'read';

/**
 * Read a saved (immutable) note with a Source / Both / Read view toggle — raw
 * Markdown, live split, or rendered. There is no editing (notes are write-once),
 * so the counterpart of the create form's "Type" is "Source" (view the raw text).
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

  const seg = (active: boolean) =>
    active
      ? 'px-2.5 py-1 font-medium bg-accent text-accent-fg'
      : 'px-2.5 py-1 text-ink-muted hover:text-ink';

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-5 py-2">
        <p className="truncate text-xs text-ink-faint">
          {author} · <span className="font-mono">{when}</span>
        </p>
        <div className="flex items-center gap-4">
          <div className="flex border border-hairline-strong text-xs">
            <button type="button" onClick={() => setView('source')} className={seg(view === 'source')}>
              Source
            </button>
            <button
              type="button"
              onClick={() => setView('both')}
              className={`border-l border-hairline-strong ${seg(view === 'both')}`}
            >
              Both
            </button>
            <button
              type="button"
              onClick={() => setView('read')}
              className={`border-l border-hairline-strong ${seg(view === 'read')}`}
            >
              Read
            </button>
          </div>
          <DownloadNote note={note} />
        </div>
      </div>

      <h2 className="shrink-0 border-b border-hairline px-5 py-3 font-serif text-xl font-semibold tracking-tight">
        {label}
      </h2>

      <div className={`grid min-h-0 flex-1 ${view === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* raw source */}
        <div
          className={`flex min-h-0 flex-col ${view === 'read' ? 'hidden' : ''} ${
            view === 'both' ? 'border-r border-hairline' : ''
          }`}
        >
          {view === 'both' && (
            <span className="label shrink-0 border-b border-hairline px-5 py-1.5 text-ink-faint">Source</span>
          )}
          <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-5 py-4 font-mono text-sm leading-relaxed text-ink">
            {note.body || '(no content)'}
          </pre>
        </div>
        {/* rendered */}
        <div className={`flex min-h-0 flex-col ${view === 'source' ? 'hidden' : ''}`}>
          {view === 'both' && (
            <span className="label shrink-0 border-b border-hairline px-5 py-1.5 text-ink-faint">Rendered</span>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {note.body ? (
              <MarkdownBody>{note.body}</MarkdownBody>
            ) : (
              <span className="text-sm text-ink-faint">No content.</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
