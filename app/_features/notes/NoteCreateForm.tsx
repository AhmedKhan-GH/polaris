'use client';

import Link from 'next/link';
import { useState } from 'react';

import { createNote } from './actions';
import { MarkdownBody } from './MarkdownBody';

/**
 * The one-shot create form for an immutable note, with a live Write / Preview
 * toggle so Markdown can be rendered before saving. Client-side only for the
 * preview state; the values still post to the `createNote` server action. Both
 * the textarea (Write) and the preview stay mounted — the textarea just hides in
 * Preview — so `body` always submits.
 */
export function NoteCreateForm() {
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(false);

  const seg = (active: boolean) =>
    active
      ? 'px-2.5 py-1 font-medium bg-accent text-accent-fg'
      : 'px-2.5 py-1 text-ink-muted hover:text-ink';

  return (
    <form action={createNote} className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-5 py-2">
        <span className="label text-ink-faint">New note</span>
        <div className="flex items-center gap-4">
          <div className="flex border border-hairline-strong text-xs">
            <button type="button" onClick={() => setPreview(false)} className={seg(!preview)}>
              Write
            </button>
            <button
              type="button"
              onClick={() => setPreview(true)}
              className={`border-l border-hairline-strong ${seg(preview)}`}
            >
              Preview
            </button>
          </div>
          <Link href="/notes" className="text-sm text-ink-muted transition-colors hover:text-ink">
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

      <div className="flex min-h-0 flex-1 flex-col">
        <textarea
          name="body"
          aria-label="Note body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write… (Markdown supported)"
          className={`min-h-0 flex-1 resize-none bg-surface px-5 py-4 text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none ${
            preview ? 'hidden' : ''
          }`}
        />
        <div className={`min-h-0 flex-1 overflow-y-auto px-5 py-4 ${preview ? '' : 'hidden'}`}>
          {body.trim() ? (
            <MarkdownBody>{body}</MarkdownBody>
          ) : (
            <span className="text-sm text-ink-faint">Nothing to preview yet.</span>
          )}
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
