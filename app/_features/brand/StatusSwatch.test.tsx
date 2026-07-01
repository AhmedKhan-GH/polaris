// StatusSwatch — one status marker rendered as the real chip (soft fill + colored
// text), in both themes, with the measured AA ratios shown. Data via props.
// jsdom (vitest default).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StatusSwatch } from './StatusSwatch';

afterEach(cleanup);

const marker = {
  token: 'warning',
  name: 'Warning',
  meaning: 'At risk',
  light: '#8a5a12',
  lightSoft: '#f6eedd',
  dark: '#d9a24e',
  darkSoft: '#2a2310',
  role: 'SLA nearing, needs attention',
};

describe('StatusSwatch', () => {
  it('shows the name, ops meaning, role, and a chip per theme', () => {
    render(<StatusSwatch marker={marker} />);
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('SLA nearing, needs attention')).toBeInTheDocument();
    // meaning labels the section header AND both theme chips
    expect(screen.getAllByText('At risk').length).toBeGreaterThanOrEqual(2);
  });

  it('labels the measured AA ratio for both themes', () => {
    render(<StatusSwatch marker={marker} />);
    expect(screen.getByText(/AA \d+\.\d:1 · \d+\.\d:1/)).toBeInTheDocument();
  });
});
