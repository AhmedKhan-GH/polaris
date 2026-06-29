// UsageExample — a framed "piece of media" tagged Do (✓) or Don't (✗) with a
// caption, used to build the brand-usage guidance. Presentational; the media
// content is passed in as children. jsdom (vitest default).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { UsageExample } from './UsageExample';

afterEach(cleanup);

describe('UsageExample', () => {
  it('frames a Do example with its caption and content', () => {
    render(
      <UsageExample ok caption="Brand colors">
        <span>the mark</span>
      </UsageExample>,
    );
    expect(screen.getByText('Do')).toBeInTheDocument();
    expect(screen.getByText('Brand colors')).toBeInTheDocument();
    expect(screen.getByText('the mark')).toBeInTheDocument();
  });

  it("frames a Don't example", () => {
    render(<UsageExample ok={false} caption="Off-brand recolor" />);
    expect(screen.getByText("Don't")).toBeInTheDocument();
    expect(screen.getByText('Off-brand recolor')).toBeInTheDocument();
  });

  it("strikes a Don't example with a top-right-to-bottom-left diagonal", () => {
    const { container } = render(<UsageExample ok={false} caption="x" />);
    const line = container.querySelector('line');
    expect(line).not.toBeNull();
    expect(line?.getAttribute('x1')).toBe('100'); // top-right
    expect(line?.getAttribute('y1')).toBe('0');
    expect(line?.getAttribute('x2')).toBe('0'); // bottom-left
    expect(line?.getAttribute('y2')).toBe('100');
  });

  it('does not strike a Do example', () => {
    const { container } = render(<UsageExample ok caption="x" />);
    expect(container.querySelector('line')).toBeNull();
  });
});
