'use client';

import { useActionState, useSyncExternalStore } from 'react';

import { signInAction, type LoginState } from './actions';

const initialState: LoginState = {};

/**
 * `true` once hydrated, `false` during SSR and the first client paint.
 *
 * This is the React-19 hydration-safe idiom for "are we past the server render":
 * `useSyncExternalStore` returns the server snapshot (`false`) for the initial
 * paint that must match the server HTML, then the client snapshot (`true`)
 * afterwards. A `setState`-in-`useEffect` mount flag would express the same
 * intent but is forbidden by `react-hooks/set-state-in-effect` (a project lint
 * law); this idiom is the sanctioned equivalent and flips at the same moment.
 */
const noopSubscribe = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Email/password sign-in form.
 *
 * Hydration note: password managers inject DOM nodes immediately adjacent to
 * password inputs BEFORE React hydrates, which corrupts SSR/CSR reconciliation
 * (the server HTML and the first client render no longer match). To sidestep it
 * we render an `aria-hidden` skeleton that approximates the form's silhouette on
 * the server and on the very first client paint, then swap in the real <form>
 * once hydrated (see `useHydrated`) — by the time the inputs exist, hydration is
 * already done, so an injected node can no longer desync the trees.
 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <div aria-hidden className="w-full max-w-sm space-y-4">
        <div className="h-4 w-16 rounded bg-zinc-200" />
        <div className="h-10 w-full rounded bg-zinc-200" />
        <div className="h-4 w-20 rounded bg-zinc-200" />
        <div className="h-10 w-full rounded bg-zinc-200" />
        <div className="h-10 w-full rounded bg-zinc-300" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      {state.error ? (
        <p aria-live="polite" className="mb-4 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span>Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
