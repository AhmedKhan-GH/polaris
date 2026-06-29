// @vitest-environment node
//
// Brand SVGs live in /public, so their URL is stable across edits — which means a
// replaced file keeps serving from the browser cache. versionedAssetSrc appends a
// short content hash, so a changed asset gets a new URL and is always refetched.

import { describe, expect, it } from 'vitest';

import { versionedAssetSrc } from './asset-url';

describe('versionedAssetSrc', () => {
  it('appends a content hash to an existing /public asset', () => {
    expect(versionedAssetSrc('/zeefoods_lockup.svg')).toMatch(
      /^\/zeefoods_lockup\.svg\?v=[0-9a-f]{8}$/,
    );
  });

  it('changes the hash when the file content differs', () => {
    const lockup = versionedAssetSrc('/zeefoods_lockup.svg');
    const wordmark = versionedAssetSrc('/zeefoods_letters.svg');
    expect(lockup).not.toBe(wordmark.replace('letters', 'lockup'));
  });

  it('returns the src untouched when the file is missing', () => {
    expect(versionedAssetSrc('/nope.svg')).toBe('/nope.svg');
  });
});
