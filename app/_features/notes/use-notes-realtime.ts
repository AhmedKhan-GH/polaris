'use client';

import { useState } from 'react';

import { topicFor } from '@/lib/realtime/topics';
import { useTopic } from '@/lib/realtime/use-topic';

/**
 * A note as it reaches the client. The server serializes `created_at` (a Date)
 * to a string across the RSC boundary, so the island works in the SERIALIZED
 * shape end to end: the page maps `createdAt.toISOString()` before passing the
 * seed in, and live broadcasts arrive as the same ISO string. Keeping one shape
 * avoids a Date-vs-string split between the seed and the streamed rows.
 */
export type NoteRowView = {
  id: string;
  createdBy: string;
  body: string;
  createdAt: string;
};

/** The snake_cased row Postgres puts in the broadcast `record` (see below). */
type BroadcastRecord = {
  id: string;
  created_by: string;
  body: string;
  created_at: string;
};

/**
 * Live-merge INSERT broadcasts on the caller's private `notes:{userId}` topic
 * onto a server-rendered seed list.
 *
 * Delivery is gated entirely at the channel layer (the `realtime.messages`
 * policy from M4): a member only ever receives their OWN topic, so this hook
 * needs no per-row authorization — what arrives is already authorized.
 *
 * New rows are PREPENDED to match `getNotes`' `created_at DESC` ordering
 * (newest first), and de-duplicated by id so an echo of a row already present
 * (e.g. the writer's own optimistic seed, or a redelivery) is ignored.
 */
export function useNotesRealtime(
  userId: string,
  initial: NoteRowView[],
): NoteRowView[] {
  const [rows, setRows] = useState(initial);

  useTopic(topicFor('notes', userId), {
    event: 'INSERT',
    onMessage: (msg) => {
      const record = extractRecord(msg);
      if (!record) return;
      const next: NoteRowView = {
        id: record.id,
        createdBy: record.created_by,
        body: record.body,
        createdAt: record.created_at,
      };
      setRows((prev) =>
        prev.some((r) => r.id === next.id) ? prev : [next, ...prev],
      );
    },
  });

  return rows;
}

/**
 * Pull the changed row out of a Supabase broadcast frame.
 *
 * `realtime.broadcast_changes` builds `{ old_record, record, operation, ... }`
 * and `realtime.send` stores it as the message payload, so supabase-js delivers
 * `{ type, event, payload: { record, ... } }` — the row sits at
 * `msg.payload.record` (verified against @supabase/realtime-js's
 * `RealtimeBroadcastInsertPayload`, whose `record: T` lives under `payload`).
 * We also accept a flat `msg.record` defensively: a direct `channel.send` of a
 * `{ record }` body (not via broadcast_changes) would deliver it un-nested, and
 * tolerating both keeps the hook robust to either producer.
 */
function extractRecord(msg: unknown): BroadcastRecord | undefined {
  if (typeof msg !== 'object' || msg === null) return undefined;
  const m = msg as { payload?: { record?: unknown }; record?: unknown };
  const record = m.payload?.record ?? m.record;
  if (typeof record !== 'object' || record === null) return undefined;
  return record as BroadcastRecord;
}
