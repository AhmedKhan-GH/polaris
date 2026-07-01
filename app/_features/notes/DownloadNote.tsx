'use client';

import { noteToMarkdown } from './noteExport';

/**
 * Download the current note as a Markdown (`.md`) file — the one bit that must be
 * client-side (Blob + object URL). Content/filename come from the pure
 * `noteToMarkdown`; this island only performs the browser save.
 */
export function DownloadNote({
  note,
}: {
  note: { id: string; title: string; body: string };
}) {
  const onClick = () => {
    const { filename, text } = noteToMarkdown(note);
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 border border-hairline-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-surface-alt"
    >
      <svg
        viewBox="0 0 16 16"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8 2.5v7" />
        <path d="m5 6.5 3 3 3-3" />
        <path d="M3 12.5h10" />
      </svg>
      Download .md
    </button>
  );
}
