// jsdom (vitest default). The action is mocked — clicking a control must call it
// with the full payload, but no server function runs in a unit test. Auto-cleanup
// is off (globals disabled), so we unmount and reset the spy after each test.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const setPreferences = vi.fn();
vi.mock('./actions', () => ({
  setPreferences: (...args: unknown[]) => setPreferences(...args),
}));

import { Hour12Toggle } from './Hour12Toggle';

afterEach(() => {
  cleanup();
  setPreferences.mockClear();
});

describe('Hour12Toggle', () => {
  it('marks the active format via aria-pressed', () => {
    render(<Hour12Toggle hour12={false} timezone="UTC" />);
    expect(screen.getByRole('button', { name: '24h' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '12h' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('sends the current timezone with the toggled hour12 on change', () => {
    render(<Hour12Toggle hour12={false} timezone="America/New_York" />);
    fireEvent.click(screen.getByRole('button', { name: '12h' }));
    expect(setPreferences).toHaveBeenCalledWith({
      timezone: 'America/New_York',
      hour12: true,
    });
  });

  it('does nothing when the already-active format is re-selected', () => {
    render(<Hour12Toggle hour12={true} timezone="UTC" />);
    fireEvent.click(screen.getByRole('button', { name: '12h' }));
    expect(setPreferences).not.toHaveBeenCalled();
  });
});
