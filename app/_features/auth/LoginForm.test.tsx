// LoginForm presentational + behaviour (app/_features/auth/LoginForm).
//
// jsdom is the default vitest environment here (a client component). `./actions`
// is mocked so no server function is invoked: `useActionState` drives the mock
// like any reducer. The component renders an `aria-hidden` skeleton on first
// paint (the server / pre-hydration snapshot) and swaps in the real <form> once
// hydrated, so every query for real fields awaits hydration via `findBy*`.

import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ signInAction: vi.fn() }));

vi.mock('./actions', () => ({
  signInAction: fake.signInAction,
  signOutAction: vi.fn(),
}));

import { LoginForm } from './LoginForm';

beforeEach(() => {
  fake.signInAction.mockReset();
  // Default: a benign no-op state so the reducer has something to return.
  fake.signInAction.mockResolvedValue({});
});

// Auto-cleanup is off (vitest `globals` is disabled, so RTL cannot register its
// own afterEach), so unmount explicitly to keep each render's DOM isolated.
afterEach(cleanup);

describe('app/_features/auth LoginForm', () => {
  it('renders the email and password fields and a Sign in button after mount', async () => {
    render(<LoginForm />);

    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Sign in' }),
    ).toBeInTheDocument();
  });

  it('shows the error returned by the action after submitting the form', async () => {
    fake.signInAction.mockResolvedValue({ error: 'Bad creds' });
    render(<LoginForm />);

    const form = (await screen.findByLabelText('Email')).closest('form')!;
    fireEvent.submit(form);

    expect(await screen.findByText('Bad creds')).toBeInTheDocument();
  });

  // Cycle 7: the pre-hydration skeleton. Under RTL's act-wrapped `render`,
  // hydration completes synchronously, so the first paint is unobservable
  // through the jsdom DOM (verified: a synchronous post-render query already
  // sees the real input). We instead assert the genuine first paint via a SERVER
  // render, which takes the server snapshot (`false`) — the exact state the
  // browser paints before hydration flips `useHydrated` to `true`.
  it('first paint (server render) shows an aria-hidden skeleton and no email input', () => {
    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).toContain('aria-hidden');
    expect(html).not.toContain('name="email"');
  });
});
