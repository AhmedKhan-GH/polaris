'use client';

import { useTransition } from 'react';

import { setPreferences } from './actions';

/**
 * 24h / 12h segmented switch for the shell top bar (ADR-0009). Sends the FULL
 * preferences payload — the current timezone travels with the toggled hour12 —
 * to `setPreferences`, wrapped in a transition so the control disables while the
 * write is in flight (the house pattern: pessimistic, never optimistic). The
 * server then re-renders the shell (`revalidatePath`), re-formatting every
 * timestamp. `aria-pressed` announces the active mode to assistive tech.
 */
export function Hour12Toggle({
  hour12,
  timezone,
}: {
  hour12: boolean;
  timezone: string;
}) {
  const [pending, startTransition] = useTransition();

  const choose = (next: boolean) => {
    if (next === hour12 || pending) return;
    startTransition(() => {
      void setPreferences({ timezone, hour12: next });
    });
  };

  return (
    <div
      role="group"
      aria-label="Time format"
      className="inline-flex items-center border border-ink-faint p-0.5 text-xs"
    >
      <Option label="24h" active={!hour12} pending={pending} onClick={() => choose(false)} />
      <Option label="12h" active={hour12} pending={pending} onClick={() => choose(true)} />
    </div>
  );
}

function Option({
  label,
  active,
  pending,
  onClick,
}: {
  label: string;
  active: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={active}
      className={
        active
          ? 'px-2 py-0.5 font-medium bg-accent text-accent-fg'
          : 'px-2 py-0.5 font-medium text-ink-muted hover:text-ink disabled:opacity-50'
      }
    >
      {label}
    </button>
  );
}
