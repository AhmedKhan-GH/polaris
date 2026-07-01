'use client';

import Link from 'next/link';
import { useState } from 'react';

import { createNote } from './actions';
import { wordCount } from './identity';
import { MarkdownBody } from './MarkdownBody';

type View = 'type' | 'both' | 'read';

/**
 * The one-shot create form for an immutable note, with a Type / Both / Read view
 * toggle: write full-width, live split, or rendered full-width. Client-side for
 * the live `body` state and view; the textarea keeps its `name` and stays mounted
 * (just hidden in Read) so the body always posts to the `createNote` server action.
 */
export function NoteCreateForm() {
  const [body, setBody] = useState('');
  const [view, setView] = useState<View>('both');

  const seg = (active: boolean) =>
    active
      ? 'px-2.5 py-1 font-medium bg-accent text-accent-fg'
      : 'px-2.5 py-1 text-ink-muted hover:text-ink';

  return (
    <form action={createNote} className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-hairline bg-surface-alt px-5">
        <span className="inline-flex shrink-0 items-center gap-1.5 border border-hairline-strong bg-surface px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
          <svg
            viewBox="0 0 24 24"
            className="size-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
          New note
        </span>
        <div className="flex items-center gap-4">
          <div className="flex border border-hairline-strong text-xs">
            <button type="button" onClick={() => setView('type')} className={seg(view === 'type')}>
              Type
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
          <Link
            href="/notes"
            className="border border-hairline-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-surface-alt"
          >
            Cancel
          </Link>
        </div>
      </div>

      <input
        name="title"
        required
        aria-label="Note title"
        placeholder="Title"
        className="shrink-0 border-b border-hairline bg-surface px-5 py-3 font-serif text-xl font-semibold tracking-tight text-ink placeholder:text-ink-faint focus:outline-none"
      />

      <div className={`grid min-h-0 flex-1 ${view === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* write — always mounted so `body` submits even in Read */}
        <div
          className={`flex min-h-0 flex-col bg-surface ${view === 'read' ? 'hidden' : ''} ${
            view === 'both' ? 'border-r border-hairline' : ''
          }`}
        >
          <textarea
            name="body"
            aria-label="Note body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write… (Markdown supported)"
            className="min-h-0 flex-1 resize-none bg-surface px-5 py-4 font-mono text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>
        {/* preview */}
        <div className={`flex min-h-0 flex-col bg-surface-alt ${view === 'type' ? 'hidden' : ''}`}>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {body.trim() ? (
              <MarkdownBody>{body}</MarkdownBody>
            ) : (
              <span className="text-sm text-ink-faint">Rendered Markdown appears here as you type.</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-hairline bg-surface-alt px-5 py-2.5">
        <span className="font-mono text-xs text-ink-faint">
          {wordCount(body)} words · Markdown · permanent once created
        </span>
        <button
          type="submit"
          className="bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
        >
          Create
        </button>
      </div>
    </form>
  );
}
