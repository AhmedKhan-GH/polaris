/**
 * The topic grammar of ADR-0002.
 *
 * `{domain}:{userId}` is a private per-user channel; `{domain}:all` is the owner
 * firehose. Gating happens in the `realtime.messages` policy (channel-layer),
 * never as row-RLS on the streamed tables.
 */
export function topicFor(domain: string, userId: string): string {
  return `${domain}:${userId}`;
}

export function topicAll(domain: string): string {
  return `${domain}:all`;
}
