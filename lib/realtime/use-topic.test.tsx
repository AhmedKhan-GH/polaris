// useTopic behaviour (lib/realtime/use-topic).
//
// jsdom environment (the vitest default here). The hook opens a private Supabase
// broadcast channel for a topic and tears it down on unmount. We hoist-mock
// `@/lib/supabase/browser` so `getSupabaseClient()` returns a stub client whose
// `realtime.setAuth`, `channel`, `.on`, `.subscribe`, and `removeChannel` are
// all spies. `channel().on()` and `.subscribe()` return the channel stub so the
// hook's fluent chain works. A shared `order` log records the sequence of the
// auth/subscribe handshake so we can assert `setAuth` runs BEFORE `channel`.
//
// Auto-cleanup is off (vitest `globals` disabled), so we unmount explicitly and
// `cleanup` after each test.

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- hoisted stub client --------------------------------------------------
const order: string[] = [];

// Captures the broadcast handler the hook registers, so a test can invoke it
// as if the server pushed a message.
let captured: ((payload: unknown) => void) | undefined;

const chanStub = {
  on: vi.fn((_type: string, _filter: unknown, handler: (payload: unknown) => void) => {
    captured = handler;
    return chanStub;
  }),
  subscribe: vi.fn(() => {
    order.push('subscribe');
    return chanStub;
  }),
};

const supabaseStub = {
  realtime: {
    setAuth: vi.fn(async () => {
      order.push('setAuth');
    }),
  },
  channel: vi.fn(() => {
    order.push('channel');
    return chanStub;
  }),
  removeChannel: vi.fn(),
};

vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseClient: () => supabaseStub,
}));

import { useTopic } from './use-topic';

beforeEach(() => {
  order.length = 0;
  captured = undefined;
  chanStub.on.mockClear();
  chanStub.subscribe.mockClear();
  supabaseStub.realtime.setAuth.mockClear();
  supabaseStub.channel.mockClear();
  supabaseStub.removeChannel.mockClear();
});

afterEach(cleanup);

describe('lib/realtime/useTopic', () => {
  it('subscribes to a private broadcast channel on mount, after setAuth', async () => {
    const onMessage = vi.fn();
    renderHook(() => useTopic('notes:u1', { event: 'INSERT', onMessage }));

    await waitFor(() => expect(chanStub.subscribe).toHaveBeenCalledTimes(1));

    expect(supabaseStub.channel).toHaveBeenCalledWith('notes:u1', {
      config: { private: true },
    });
    expect(chanStub.on).toHaveBeenCalledWith(
      'broadcast',
      { event: 'INSERT' },
      expect.any(Function),
    );
    expect(supabaseStub.realtime.setAuth).toHaveBeenCalledTimes(1);
    // setAuth must load the session token onto the socket BEFORE we open the
    // private channel — otherwise the subscription is rejected.
    expect(order.indexOf('setAuth')).toBeLessThan(order.indexOf('channel'));
  });

  it('forwards a broadcast payload to onMessage', async () => {
    const onMessage = vi.fn();
    renderHook(() => useTopic('notes:u1', { event: 'INSERT', onMessage }));

    await waitFor(() => expect(captured).toBeTypeOf('function'));

    const payload = { event: 'INSERT', payload: { id: 1 } };
    captured!(payload);

    expect(onMessage).toHaveBeenCalledWith(payload);
  });

  it('removes the channel on unmount', async () => {
    const onMessage = vi.fn();
    const { unmount } = renderHook(() =>
      useTopic('notes:u1', { event: 'INSERT', onMessage }),
    );

    await waitFor(() => expect(chanStub.subscribe).toHaveBeenCalledTimes(1));
    unmount();

    await waitFor(() =>
      expect(supabaseStub.removeChannel).toHaveBeenCalledTimes(1),
    );
    expect(supabaseStub.removeChannel).toHaveBeenCalledWith(chanStub);
  });
});
