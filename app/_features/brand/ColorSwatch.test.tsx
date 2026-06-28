// ColorSwatch — a presentational chip for one brand color. Brand data arrives via
// props (never hardcoded; Charter D8). jsdom (vitest default).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ColorSwatch } from './ColorSwatch';

afterEach(cleanup);

const blue = { name: 'Zee Foods Blue', hex: '#00447c', role: 'Primary — wordmark, headings' };

describe('ColorSwatch', () => {
  it('shows the color name, hex, and usage role', () => {
    render(<ColorSwatch color={blue} />);
    expect(screen.getByText('Zee Foods Blue')).toBeInTheDocument();
    expect(screen.getByText('#00447c')).toBeInTheDocument();
    expect(screen.getByText('Primary — wordmark, headings')).toBeInTheDocument();
  });

  it('renders a swatch wired to the hex (identifiable by its value)', () => {
    render(<ColorSwatch color={blue} />);
    expect(screen.getByTitle('#00447c')).toBeInTheDocument();
  });
});
