import type { Tone } from './palette';

/**
 * One interface token, shown in both themes (light chip | dark chip) so both values
 * are legible whatever theme the Brand page renders in. Server component; values
 * arrive via props from palette.ts (welded to globals.css).
 */
export function TokenSwatch({ tone }: { tone: Tone }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex shrink-0 overflow-hidden border border-hairline-strong">
        <div className="size-11" style={{ backgroundColor: tone.light }} aria-hidden />
        <div className="size-11" style={{ backgroundColor: tone.dark }} aria-hidden />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-ink">{tone.name}</span>
        <span className="font-mono text-xs text-ink-muted">
          {tone.light} · {tone.dark}
        </span>
        <span className="text-xs text-ink-faint">{tone.role}</span>
        <code className="mt-0.5 w-fit bg-surface-alt px-1 font-mono text-[11px] text-ink-muted">
          {tone.token}
        </code>
      </div>
    </div>
  );
}
