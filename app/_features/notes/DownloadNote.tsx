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
      className="border border-hairline-strong px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
    >
      Download .md
    </button>
  );
}
