// @vitest-environment node
//
// Topic-grammar contract (lib/realtime/topics). Pure string builders for the
// ADR-0002 channel naming scheme; no environment needed, so we run in `node`.

import { describe, expect, it } from 'vitest';

import { topicAll, topicFor } from './topics';

describe('lib/realtime/topics', () => {
  it('topicFor builds a private per-user topic as `${domain}:${userId}`', () => {
    expect(topicFor('notes', 'u1')).toBe('notes:u1');
  });

  it('topicAll builds the owner firehose topic as `${domain}:all`', () => {
    expect(topicAll('notes')).toBe('notes:all');
  });
});
