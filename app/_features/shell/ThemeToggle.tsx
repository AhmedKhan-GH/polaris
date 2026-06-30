'use client';

import { useTransition } from 'react';

import type { Theme } from '@/lib/preferences';

import { setPreferences } from './actions';

/**
 * Light / Dark segmented switch for the shell top bar. Sends the FULL preferences
 * payload — the current timezone and hour12 travel with the chosen theme — to
 * `setPreferences`, wrapped in a transition so the control disables while the
 * write is in flight (the house pattern: pessimistic, never optimistic). The
 * server then re-renders the shell (`revalidatePath('/', 'layout')`), which
 * re-applies the `dark` class on <html>. `aria-pressed` announces the active mode.
 */
export function ThemeToggle({
  theme,
  timezone,
  hour12,
}: {
  theme: Theme;
  timezone: string;
  hour12: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const choose = (next: Theme) => {
    if (next === theme || pending) return;
    startTransition(() => {
      void setPreferences({ timezone, hour12, theme: next });
    });
  };

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="inline-flex items-center border border-hairline p-0.5 text-xs"
    >
      <Option label="Light" active={theme === 'light'} pending={pending} onClick={() => choose('light')} />
      <Option label="Dark" active={theme === 'dark'} pending={pending} onClick={() => choose('dark')} />
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
