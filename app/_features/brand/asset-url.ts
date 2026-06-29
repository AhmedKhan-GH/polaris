// Cache-busting for the static brand SVGs. Files under /public keep a stable URL
// across edits, so a replaced asset serves stale from the browser cache. Appending
// a short content hash gives a changed file a fresh URL — it's always refetched,
// and an unchanged file keeps the same URL (so it stays cacheable). Server-only
// (reads the file); the brand page versions each src before passing it to the
// presentational components.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function versionedAssetSrc(src: string): string {
  const path = src.replace(/^\//, '').split('?')[0];
  try {
    const hash = createHash('sha1')
      .update(readFileSync(join(process.cwd(), 'public', path)))
      .digest('hex')
      .slice(0, 8);
    return `${src}?v=${hash}`;
  } catch {
    return src; // asset missing — leave the URL as-is rather than break the page
  }
}
