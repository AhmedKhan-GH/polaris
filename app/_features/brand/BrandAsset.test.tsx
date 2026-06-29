// BrandAsset — a downloadable brand file: a preview, a colorway selector
// (Color / Black / White), and a download link for the picked colorway. Picking a
// colorway updates the preview (and its panel) and the download. Asset data via
// props (Charter D8). jsdom default.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BrandAsset } from './BrandAsset';

afterEach(cleanup);

const banner = { src: '/zeefoods_lockup.svg', alt: 'Zee Foods', width: 234, height: 80 };
const variants = [
  { label: 'Color', src: '/zeefoods_lockup.svg' },
  { label: 'Black', src: '/zeefoods_lockup_black.svg' },
  { label: 'White', src: '/zeefoods_lockup_white.svg', dark: true },
];

describe('BrandAsset', () => {
  it('previews the first colorway and offers it for download', () => {
    render(<BrandAsset asset={banner} label="Lockup" variants={variants} />);
    expect(screen.getByText('Lockup')).toBeInTheDocument();
    expect(screen.getByText('zeefoods_lockup.svg')).toBeInTheDocument();
    expect(screen.getByAltText('Zee Foods')).toHaveAttribute('src', '/zeefoods_lockup.svg');
    const dl = screen.getByRole('link', { name: /download/i });
    expect(dl).toHaveAttribute('href', '/zeefoods_lockup.svg');
    expect(dl).toHaveAttribute('download', 'zeefoods_lockup.svg');
  });

  it('selecting a colorway updates the preview, filename, and download', () => {
    const { container } = render(<BrandAsset asset={banner} label="Lockup" variants={variants} />);
    fireEvent.click(screen.getByRole('button', { name: 'White' }));
    expect(screen.getByAltText('Zee Foods')).toHaveAttribute('src', '/zeefoods_lockup_white.svg');
    expect(screen.getByText('zeefoods_lockup_white.svg')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /download/i })).toHaveAttribute(
      'href',
      '/zeefoods_lockup_white.svg',
    );
    // the white colorway previews on a dark panel
    expect(container.querySelector('[data-preview="dark"]')).not.toBeNull();
  });

  it('marks the active colorway as pressed', () => {
    render(<BrandAsset asset={banner} label="Lockup" variants={variants} />);
    expect(screen.getByRole('button', { name: 'Color' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Black' }));
    expect(screen.getByRole('button', { name: 'Black' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Color' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows an optional usage note', () => {
    render(<BrandAsset asset={banner} label="Leaf" note="White leaf only" variants={variants} />);
    expect(screen.getByText('White leaf only')).toBeInTheDocument();
  });
});
