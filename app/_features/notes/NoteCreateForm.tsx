'use client';

import Link from 'next/link';
import { useState } from 'react';

import { createNote } from './actions';
import { MarkdownBody } from './MarkdownBody';

/**
 * The one-shot create form for an immutable note, with a LIVE split preview: you
 * type Markdown on the left and it renders on the right as you type (side-by-side
 * on md+, stacked below). Client-side for the live `body` state; the value still
 * posts to the `createNote` server action via the textarea's `name`.
 */
export function NoteCreateForm() {
  const [body, setBody] = useState('');

  return (
    <form action={createNote} className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-5 py-2.5">
        <span className="label text-ink-faint">New note · live preview</span>
        <Link href="/notes" className="text-sm text-ink-muted transition-colors hover:text-ink">
          Cancel
        </Link>
      </div>

      <input
        name="title"
        required
        aria-label="Note title"
        placeholder="Title"
        className="shrink-0 border-b border-hairline bg-surface px-5 py-3 font-serif text-xl font-semibold tracking-tight text-ink placeholder:text-ink-faint focus:outline-none"
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        {/* write */}
        <div className="flex min-h-0 flex-col border-b border-hairline md:border-b-0 md:border-r">
          <span className="label shrink-0 border-b border-hairline px-5 py-1.5 text-ink-faint">Write</span>
          <textarea
            name="body"
            aria-label="Note body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write… (Markdown supported)"
            className="min-h-0 flex-1 resize-none bg-surface px-5 py-4 font-mono text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>
        {/* live preview */}
        <div className="flex min-h-0 flex-col">
          <span className="label shrink-0 border-b border-hairline px-5 py-1.5 text-ink-faint">Preview</span>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {body.trim() ? (
              <MarkdownBody>{body}</MarkdownBody>
            ) : (
              <span className="text-sm text-ink-faint">Rendered Markdown appears here as you type.</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-hairline px-5 py-2.5">
        <span className="text-xs text-ink-faint">
          Markdown supported. Notes are permanent once created.
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
