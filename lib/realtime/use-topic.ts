'use client';

import { useEffect, useRef } from 'react';

import { getSupabaseClient } from '@/lib/supabase/browser';

/**
 * Subscribe to a private Supabase broadcast channel for `topic` (ADR-0002
 * grammar — see lib/realtime/topics). `onMessage` fires for each broadcast of
 * `opts.event` on that topic.
 */
export function useTopic(
  topic: string,
  opts: { event: string; onMessage: (payload: unknown) => void },
): void {
  // Hold the latest onMessage in a ref so a fresh handler identity on each
  // render does not retrigger the subscription effect and resubscribe the
  // channel. The ref is synced in its own effect (writing a ref during render
  // is disallowed) and is intentionally absent from the subscribe effect's deps.
  const onMessage = useRef(opts.onMessage);
  useEffect(() => {
    onMessage.current = opts.onMessage;
  }, [opts.onMessage]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    // setAuth is async, so cleanup can fire before the channel exists. Track
    // disposal: the IIFE tears down immediately if unmounted mid-setup, and
    // cleanup removes the channel if it has already been created.
    let cancelled = false;

    void (async () => {
      // Load the current session token onto the realtime socket — REQUIRED for
      // private channels, whose subscription is rejected without it.
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel(topic, { config: { private: true } })
        .on('broadcast', { event: opts.event }, (payload) =>
          onMessage.current(payload),
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [topic, opts.event]);
}
