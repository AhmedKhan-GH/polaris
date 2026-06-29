import type { ReactNode } from 'react';

/**
 * A single brand-usage example: a framed "piece of media" tagged Do or Don't, with
 * a caption beneath. A Don't is struck through with one red diagonal line from the
 * top-right to the bottom-left corner (the Stanford identity-guide convention); a
 * Do gets a small green check. Presentational — the media content is passed in.
 */
export function UsageExample({
  ok,
  caption,
  children,
}: {
  ok: boolean;
  caption: string;
  children?: ReactNode;
}) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="relative flex aspect-[3/2] items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-white p-6">
        {children}
        {ok ? (
          <span
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white"
            aria-hidden
          >
            ✓
          </span>
        ) : (
          // One diagonal, top-right → bottom-left, spanning the whole frame.
          // preserveAspectRatio="none" stretches the 0–100 box to the frame so the
          // line hits the corners exactly; non-scaling-stroke keeps it a crisp 2px.
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <line
              x1="100"
              y1="0"
              x2="0"
              y2="100"
              stroke="#dc2626"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>
      <figcaption className="text-xs">
        <span className={`font-semibold ${ok ? 'text-green-700' : 'text-red-700'}`}>
          {ok ? 'Do' : "Don't"}
        </span>{' '}
        <span className="text-zinc-600">{caption}</span>
      </figcaption>
    </figure>
  );
}
