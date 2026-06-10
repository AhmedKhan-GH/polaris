// ChunkErrorReloader behaviour (app/_features/shell/ChunkErrorReloader).
//
// jsdom environment (vitest default here). The component is a null-rendering
// client effect that listens on `window` for `error`/`unhandledrejection` and
// reloads the page when the message looks like a stale-chunk load failure. We
// drive it by dispatching real DOM events and asserting on a stubbed
// `window.location.reload`. jsdom's own `reload` is a no-op that logs a "not
// implemented" navigation error, so we redefine `window.location` with a spy.
// Auto-cleanup is off (vitest `globals` disabled), so we unmount explicitly.

import { render, cleanup, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChunkErrorReloader } from './ChunkErrorReloader';

const reload = vi.fn();

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { reload },
  });
  sessionStorage.clear();
  reload.mockReset();
});

afterEach(cleanup);

function fireError(message: string) {
  window.dispatchEvent(new ErrorEvent('error', { message }));
}

function fireRejection(reason: unknown) {
  const ev = new Event('unhandledrejection');
  (ev as unknown as { reason: unknown }).reason = reason;
  window.dispatchEvent(ev);
}

describe('ChunkErrorReloader', () => {
  it('reloads when an error event reports a chunk load failure', () => {
    render(<ChunkErrorReloader />);

    fireError('ChunkLoadError: Failed to load chunk /_next/static/app/page.js');

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads when an unhandled rejection carries a chunk load error', () => {
    render(<ChunkErrorReloader />);

    fireRejection(
      new Error('ChunkLoadError: Failed to load chunk hmr-client'),
    );

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('ignores a non-chunk error', () => {
    render(<ChunkErrorReloader />);

    fireError('TypeError: x is not a function');

    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads only once for back-to-back chunk errors (cooldown)', () => {
    render(<ChunkErrorReloader />);

    fireError('ChunkLoadError: Failed to load chunk a');
    fireError('ChunkLoadError: Failed to load chunk b');

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('removes its listeners on unmount', () => {
    const { unmount } = render(<ChunkErrorReloader />);

    act(() => unmount());
    fireError('ChunkLoadError: Failed to load chunk after unmount');

    expect(reload).not.toHaveBeenCalled();
  });
});
