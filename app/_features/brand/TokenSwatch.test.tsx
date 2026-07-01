// TokenSwatch — a presentational chip for one interface token, showing its light
// AND dark value so both read whatever theme the page is in. Data via props
// (never hardcoded; Charter D8). jsdom (vitest default).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TokenSwatch } from './TokenSwatch';

afterEach(cleanup);

const tone = {
  token: 'surface-alt',
  name: 'Muted surface',
  light: '#f5f7f9',
  dark: '#1c222b',
  role: 'Table heads, insets, code',
};

describe('TokenSwatch', () => {
  it('shows the name, both hexes, role, and the Tailwind token stem', () => {
    render(<TokenSwatch tone={tone} />);
    expect(screen.getByText('Muted surface')).toBeInTheDocument();
    expect(screen.getByText(/#f5f7f9/)).toBeInTheDocument();
    expect(screen.getByText(/#1c222b/)).toBeInTheDocument();
    expect(screen.getByText('Table heads, insets, code')).toBeInTheDocument();
    expect(screen.getByText('surface-alt')).toBeInTheDocument();
  });
});
