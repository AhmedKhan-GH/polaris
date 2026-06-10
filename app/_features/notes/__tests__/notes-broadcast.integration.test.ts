import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { isLiveDbReachable, LIVE_DB, liveDbGate } from '@/lib/db/__tests__/live-db';

/**
 * notes realtime plumbing, against the REAL local Supabase stack (`supabase
 * start`). The testcontainer can't host these: the M4 trigger calls
 * `realtime.broadcast_changes` and the gating policy calls `auth.uid()` over
 * `realtime.messages`, all of which exist only on the Supabase stack — so this
 * suite reaches `:54322` directly, exactly like the profiles-RLS suite.
 *
 * Gate: probe reachability, then {@link liveDbGate} decides. Unreachable + no
 * `CI_REQUIRE_LIVE_DB` → skip (local dev without the stack stays green);
 * unreachable + `CI_REQUIRE_LIVE_DB` → the gate THROWS at collection so the
 * realtime guarantees can't vanish into a false green.
 *
 * Two guarantees are proven:
 *  1. The TRIGGER fires: a superuser INSERT broadcasts the row to both the
 *     owner's private `notes:{owner}` topic and the `notes:all` firehose
 *     (rows land in `realtime.messages`).
 *  2. The POLICY gates: replaying the authenticated request path inside
 *     rolled-back transactions, the owner sees their own topic's messages while
 *     a different user sees ZERO of them — channel-layer isolation (ADR-0002).
 *
 * Seeding/cleanup run as the superuser (bypasses RLS). The owner id is read from
 * the seeded `owner@example.com` profile (stable per seed); if absent (the suite
 * ran without the e2e seed), we upsert one so the suite is self-contained.
 */
const reachable = await isLiveDbReachable();
const mode = liveDbGate(reachable, !!process.env.CI_REQUIRE_LIVE_DB);

// A second, deliberately-unseeded user: the policy must DENY it the owner's
// topic. No profiles row is needed — the deny path never reads one.
const OTHER = '2f000000-0000-0000-0000-0000000000ff';
const PROBE_BODY = 'rt probe';

/** Count messages currently stored for `topic` (parent table routes partitions). */
async function topicCount(client: pg.Client, topic: string): Promise<number> {
  const { rows } = await client.query(
    'select count(*)::int as n from realtime.messages where topic = $1',
    [topic],
  );
  return rows[0].n as number;
}

/**
 * Count the messages on `topic` VISIBLE to `sub` through the realtime.messages
 * policy: become `authenticated`, feed `auth.uid()` via the JWT claims, set the
 * `realtime.topic` GUC the policy's `realtime.topic()` reads, then SELECT — RLS
 * returns only rows the USING clause admits. Always rolled back.
 */
async function visibleTopicCount(
  client: pg.Client,
  sub: string,
  topic: string,
): Promise<number> {
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL ROLE authenticated');
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub, role: 'authenticated' }),
    ]);
    await client.query(`select set_config('realtime.topic', $1, true)`, [topic]);
    const { rows } = await client.query(
      'select count(*)::int as n from realtime.messages where topic = $1',
      [topic],
    );
    return rows[0].n as number;
  } finally {
    await client.query('ROLLBACK');
  }
}

describe.skipIf(mode === 'skip')('notes realtime broadcast (live Supabase)', () => {
  let client: pg.Client;
  let ownerId: string;
  let ownerTopic: string;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: LIVE_DB });
    await client.connect();

    // Resolve the owner id from the seeded profile; upsert one if the suite runs
    // without the e2e seed so it stands alone.
    const found = await client.query(
      `select id from profiles where email = 'owner@example.com'`,
    );
    if (found.rows.length > 0) {
      ownerId = found.rows[0].id as string;
    } else {
      ownerId = '10000000-0000-0000-0000-0000000000a1';
      await client.query(
        `insert into profiles (id, email, role) values ($1, 'owner@example.com', 'owner')
           on conflict (id) do update set role = excluded.role`,
        [ownerId],
      );
    }
    ownerTopic = `notes:${ownerId}`;

    // Trigger the broadcast: a superuser INSERT fires the M4 trigger, which
    // broadcasts to both the owner topic and the firehose.
    await client.query(
      `insert into notes (created_by, body) values ($1, $2)`,
      [ownerId, PROBE_BODY],
    );
  });

  afterAll(async () => {
    if (!client) return;
    // Remove the probe note and every message it produced on both topics.
    await client.query(`delete from notes where body = $1 and created_by = $2`, [
      PROBE_BODY,
      ownerId,
    ]);
    await client.query(`delete from realtime.messages where topic = any($1)`, [
      [ownerTopic, 'notes:all'],
    ]);
    await client.end();
  });

  it('the trigger broadcasts the insert to the owner topic and the firehose', async () => {
    // The trigger runs synchronously inside the INSERT, but poll briefly to stay
    // robust to any partition/visibility lag.
    let ownerN = 0;
    let allN = 0;
    for (let i = 0; i < 20; i++) {
      ownerN = await topicCount(client, ownerTopic);
      allN = await topicCount(client, 'notes:all');
      if (ownerN >= 1 && allN >= 1) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(ownerN).toBeGreaterThanOrEqual(1);
    expect(allN).toBeGreaterThanOrEqual(1);
  });

  it('the policy lets the owner read their own topic but denies another user', async () => {
    const ownerSees = await visibleTopicCount(client, ownerId, ownerTopic);
    expect(ownerSees).toBeGreaterThanOrEqual(1);

    const otherSees = await visibleTopicCount(client, OTHER, ownerTopic);
    expect(otherSees).toBe(0);
  });
});
