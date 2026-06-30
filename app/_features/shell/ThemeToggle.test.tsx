// jsdom (vitest default). The action is mocked — clicking a control must call it
// with the full payload (theme + the current timezone/hour12), but no server
// function runs in a unit test. Auto-cleanup is off (globals disabled), so we
// unmount and reset the spy after each test.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const setPreferences = vi.fn();
vi.mock('./actions', () => ({
  setPreferences: (...args: unknown[]) => setPreferences(...args),
}));

import { ThemeToggle } from './ThemeToggle';

afterEach(() => {
  cleanup();
  setPreferences.mockClear();
});

describe('ThemeToggle', () => {
  it('marks the active theme via aria-pressed', () => {
    render(<ThemeToggle theme="light" timezone="UTC" hour12={false} />);
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('sends the chosen theme with the current timezone and hour12 on change', () => {
    render(<ThemeToggle theme="light" timezone="America/New_York" hour12={true} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(setPreferences).toHaveBeenCalledWith({
      timezone: 'America/New_York',
      hour12: true,
      theme: 'dark',
    });
  });

  it('does nothing when the already-active theme is re-selected', () => {
    render(<ThemeToggle theme="dark" timezone="UTC" hour12={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(setPreferences).not.toHaveBeenCalled();
  });
});
