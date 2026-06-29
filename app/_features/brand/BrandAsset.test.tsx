// BrandAsset — a downloadable brand file: preview + label + a download link to the
// raw SVG served from /public. Asset data via props (Charter D8). jsdom default.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BrandAsset } from './BrandAsset';

afterEach(cleanup);

const banner = { src: '/zeefoods_lockup.svg', alt: 'Zee Foods', width: 234, height: 80 };

describe('BrandAsset', () => {
  it('previews the asset and labels it with its filename', () => {
    render(<BrandAsset asset={banner} label="Banner" />);
    expect(screen.getByText('Banner')).toBeInTheDocument();
    expect(screen.getByText('zeefoods_lockup.svg')).toBeInTheDocument();
    expect(screen.getByAltText('Zee Foods')).toBeInTheDocument();
  });

  it('serves the raw SVG via a download link', () => {
    render(<BrandAsset asset={banner} label="Banner" />);
    const link = screen.getByRole('link', { name: /download/i });
    expect(link).toHaveAttribute('href', '/zeefoods_lockup.svg');
    expect(link).toHaveAttribute('download');
  });

  it('shows an optional usage note', () => {
    render(<BrandAsset asset={banner} label="Leaf" note="White leaf only" />);
    expect(screen.getByText('White leaf only')).toBeInTheDocument();
  });

  it('uses a dark preview panel when asked (for light marks on transparency)', () => {
    const { container } = render(<BrandAsset asset={banner} label="Leaf" preview="dark" />);
    expect(container.querySelector('[data-preview="dark"]')).not.toBeNull();
  });
});
