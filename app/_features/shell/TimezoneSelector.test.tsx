// jsdom (vitest default). The action is mocked; changing the dropdown must call
// it with the chosen zone and the current hour12. Auto-cleanup is off (globals
// disabled), so we unmount and reset the spy after each test.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const setPreferences = vi.fn();
vi.mock('./actions', () => ({
  setPreferences: (...args: unknown[]) => setPreferences(...args),
}));

import { TimezoneSelector } from './TimezoneSelector';

const ZONES = ['UTC', 'America/New_York', 'Asia/Tokyo'];

afterEach(() => {
  cleanup();
  setPreferences.mockClear();
});

describe('TimezoneSelector', () => {
  it('renders the zones and selects the current one', () => {
    render(<TimezoneSelector timezone="America/New_York" hour12={true} zones={ZONES} />);
    const select = screen.getByRole('combobox', {
      name: 'Time zone',
    }) as HTMLSelectElement;
    expect(select.value).toBe('America/New_York');
    expect(screen.getByRole('option', { name: 'Asia/Tokyo' })).toBeInTheDocument();
  });

  it('sends the chosen zone with the current hour12 on change', () => {
    render(<TimezoneSelector timezone="UTC" hour12={true} zones={ZONES} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Time zone' }), {
      target: { value: 'Asia/Tokyo' },
    });
    expect(setPreferences).toHaveBeenCalledWith({
      timezone: 'Asia/Tokyo',
      hour12: true,
    });
  });
});
