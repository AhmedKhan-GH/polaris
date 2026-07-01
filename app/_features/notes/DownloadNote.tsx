'use client';

import { noteToTxt } from './noteTxt';

/**
 * Download the current note as a `.txt` file — the one bit of the editor that
 * must be client-side (Blob + object URL). Content/filename come from the pure
 * `noteToTxt` (unit-tested); this island only performs the browser save.
 */
export function DownloadNote({
  note,
  timezone,
  hour12,
}: {
  note: { id: string; title: string; createdBy: string; body: string; createdAt: string };
  timezone: string;
  hour12: boolean;
}) {
  const onClick = () => {
    const { filename, text } = noteToTxt(note, timezone, hour12);
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
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
      Download .txt
    </button>
  );
}
