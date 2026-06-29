import type { ReactNode } from 'react';

/**
 * A single, compact brand-usage example: a framed "piece of media" tagged Do or
 * Don't, with a short caption. A Don't is struck through with one red diagonal from
 * the top-right to the bottom-left corner (the Stanford identity-guide convention);
 * a Do gets a small green check. `ground` sets the panel — white (default), a very light
 * grey (to show a mark holds up on a light, non-white ground), or dark (for reversed marks).
 * Presentational — the media content is passed in, so each case shows many of them.
 */
export function UsageExample({
  ok,
  caption,
  ground = 'white',
  children,
}: {
  ok: boolean;
  caption: string;
  ground?: 'white' | 'grey' | 'dark';
  children?: ReactNode;
}) {
  const panel =
    ground === 'dark'
      ? 'border-zinc-700 bg-zinc-900'
      : ground === 'grey'
        ? 'border-zinc-200 bg-zinc-100'
        : 'border-zinc-200 bg-white';
  return (
    <figure className="flex flex-col gap-1.5">
      <div
        className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border p-3 ${panel}`}
      >
        {children}
        {ok ? (
          <span
            className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-600 text-[9px] font-bold text-white"
            aria-hidden
          >
            ✓
          </span>
        ) : (
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
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>
      <figcaption className="text-[11px] leading-tight">
        <span className={`font-semibold ${ok ? 'text-green-700' : 'text-red-700'}`}>
          {ok ? 'Do' : "Don't"}
        </span>{' '}
        <span className="text-zinc-600">{caption}</span>
      </figcaption>
    </figure>
  );
}
