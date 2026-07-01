'use client';

import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Render a note body as Markdown, styled with the design tokens. Raw HTML is NOT
 * enabled (react-markdown's safe default), so untrusted note content can't inject
 * markup. GFM adds tables, task lists, strikethrough, and autolinks.
 */
const components: Components = {
  h1: ({ node: _n, ...p }) => <h1 className="mb-2 mt-4 font-serif text-xl font-semibold tracking-tight" {...p} />,
  h2: ({ node: _n, ...p }) => <h2 className="mb-2 mt-4 font-serif text-lg font-semibold tracking-tight" {...p} />,
  h3: ({ node: _n, ...p }) => <h3 className="mb-1.5 mt-3 text-base font-semibold" {...p} />,
  p: ({ node: _n, ...p }) => <p className="my-2" {...p} />,
  a: ({ node: _n, ...p }) => (
    <a className="text-accent-text underline hover:no-underline" target="_blank" rel="noopener noreferrer" {...p} />
  ),
  ul: ({ node: _n, ...p }) => <ul className="my-2 list-disc pl-5" {...p} />,
  ol: ({ node: _n, ...p }) => <ol className="my-2 list-decimal pl-5" {...p} />,
  li: ({ node: _n, ...p }) => <li className="my-0.5" {...p} />,
  blockquote: ({ node: _n, ...p }) => (
    <blockquote className="my-2 border-l-2 border-hairline-strong pl-3 text-ink-muted" {...p} />
  ),
  code: ({ node: _n, ...p }) => (
    <code className="bg-surface-alt px-1 py-0.5 font-mono text-[0.85em]" {...p} />
  ),
  pre: ({ node: _n, ...p }) => (
    <pre
      className="my-3 overflow-x-auto border border-hairline bg-surface-alt p-3 font-mono text-xs [&>code]:bg-transparent [&>code]:p-0"
      {...p}
    />
  ),
  hr: () => <hr className="my-4 border-hairline" />,
  table: ({ node: _n, ...p }) => <table className="my-3 w-full border-collapse text-left" {...p} />,
  th: ({ node: _n, ...p }) => (
    <th className="border border-hairline bg-surface-alt px-2 py-1 text-xs font-semibold" {...p} />
  ),
  td: ({ node: _n, ...p }) => <td className="border border-hairline px-2 py-1" {...p} />,
  strong: ({ node: _n, ...p }) => <strong className="font-semibold" {...p} />,
  em: ({ node: _n, ...p }) => <em className="italic" {...p} />,
};

export function MarkdownBody({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed text-ink [&>*:first-child]:mt-0">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </Markdown>
    </div>
  );
}
