// BackButton chrome (app/_features/shell/BackButton) — jsdom (vitest default).
//
// A client island whose only job is "go back where we came from". We mock
// next/navigation so the click is observable without a real router.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: nav.back, push: nav.push }),
}));

import { BackButton } from './BackButton';

afterEach(() => {
  cleanup();
  nav.back.mockReset();
  nav.push.mockReset();
});

function setHistoryLength(n: number) {
  Object.defineProperty(window.history, 'length', { configurable: true, value: n });
}

describe('BackButton', () => {
  it('renders a Back control', () => {
    render(<BackButton />);
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('goes back when there is history to return to', () => {
    setHistoryLength(3);
    render(<BackButton />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(nav.back).toHaveBeenCalledTimes(1);
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('falls back to /dashboard on a direct load (no prior history)', () => {
    setHistoryLength(1);
    render(<BackButton />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(nav.push).toHaveBeenCalledWith('/dashboard');
    expect(nav.back).not.toHaveBeenCalled();
  });
});
