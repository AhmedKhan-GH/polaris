// useNotesRealtime behaviour (app/_features/notes/use-notes-realtime).
//
// jsdom (vitest default here). The hook layers live INSERT broadcasts on top of
// a server-rendered seed list. We hoist-mock `@/lib/realtime/use-topic` so the
// real Supabase socket never opens: the mock records the topic + event the hook
// subscribes to and CAPTURES `opts.onMessage`, letting a test invoke it as if the
// server had pushed a broadcast frame.
//
// The captured handler is fed the SAME envelope shape Supabase delivers for a
// `realtime.broadcast_changes` INSERT — `{ type, event, payload: { record } }`
// (verified against @supabase/realtime-js RealtimeBroadcastInsertPayload). Rows
// arrive snake_cased from Postgres; the hook maps them to the island row type
// whose `createdAt` is the serialized (string) form crossing the RSC boundary.
//
// Auto-cleanup is off (vitest `globals` disabled), so we `cleanup` after each.

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- hoisted useTopic mock ------------------------------------------------
// Records the last subscription and captures the onMessage handler.
const sub: { topic?: string; event?: string } = {};
let onMessage: ((payload: unknown) => void) | undefined;

vi.mock('@/lib/realtime/use-topic', () => ({
  useTopic: (topic: string, opts: { event: string; onMessage: (p: unknown) => void }) => {
    sub.topic = topic;
    sub.event = opts.event;
    onMessage = opts.onMessage;
  },
}));

import type { NoteRowView } from './use-notes-realtime';
import { useNotesRealtime } from './use-notes-realtime';

const USER = 'user-1';
const seed: NoteRowView[] = [
  { id: 'a', createdBy: USER, body: 'seeded', createdAt: '2026-01-01T00:00:00.000Z' },
];

/** Build the Supabase broadcast envelope for a notes INSERT of `record`. */
function insertFrame(record: Record<string, unknown>) {
  return { type: 'broadcast', event: 'INSERT', payload: { operation: 'INSERT', record } };
}

beforeEach(() => {
  sub.topic = undefined;
  sub.event = undefined;
  onMessage = undefined;
});

afterEach(cleanup);

describe('app/_features/notes useNotesRealtime', () => {
  it('returns the initial rows and subscribes to the user topic for INSERT', () => {
    const { result } = renderHook(() => useNotesRealtime(USER, seed));

    expect(result.current).toEqual(seed);
    expect(sub.topic).toBe('notes:user-1');
    expect(sub.event).toBe('INSERT');
  });

  it('prepends a broadcast INSERT (snake→camel) and ignores a duplicate id', () => {
    const { result } = renderHook(() => useNotesRealtime(USER, seed));

    act(() => {
      onMessage!(
        insertFrame({
          id: 'b',
          created_by: USER,
          body: 'live',
          created_at: '2026-02-02T00:00:00.000Z',
        }),
      );
    });

    // Newest-first: the live row is prepended ahead of the seed, mapped to camel.
    expect(result.current).toEqual([
      { id: 'b', createdBy: USER, body: 'live', createdAt: '2026-02-02T00:00:00.000Z' },
      ...seed,
    ]);

    // A redelivery of the SAME id is a no-op (dedup by id), not a second row.
    act(() => {
      onMessage!(
        insertFrame({
          id: 'b',
          created_by: USER,
          body: 'live',
          created_at: '2026-02-02T00:00:00.000Z',
        }),
      );
    });
    expect(result.current).toHaveLength(2);
  });
});
