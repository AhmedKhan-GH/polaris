// ProductCombobox (app/_features/orders/ProductCombobox) — jsdom (vitest default).
//
// A fuzzy product picker for line-item intake: type to filter SKUs/names
// (fuzzysort), keyboard-select, and it writes the chosen id into a hidden
// `productId` input so the surrounding add-line form submits unchanged.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ProductCombobox } from './ProductCombobox';

const PRODUCTS = [
  { id: 'p1', sku: 'WGT-1001', name: 'Steel Widget', priceCents: 500 },
  { id: 'p2', sku: 'GDT-2002', name: 'Brass Gadget', priceCents: 750 },
  { id: 'p3', sku: 'BLT-3003', name: 'Hex Bolt', priceCents: 25 },
];

afterEach(cleanup);

const hiddenId = () =>
  document.querySelector<HTMLInputElement>('input[name="productId"]')!;

describe('ProductCombobox', () => {
  it('renders a search input and starts with no product selected', () => {
    render(<ProductCombobox products={PRODUCTS} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(hiddenId().value).toBe('');
  });

  it('requires a value so an empty box cannot submit the add-line form', () => {
    render(<ProductCombobox products={PRODUCTS} />);
    expect(screen.getByRole('combobox')).toBeRequired();
  });

  it('fuzzy-filters by name or SKU as you type', () => {
    render(<ProductCombobox products={PRODUCTS} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'widget' } });
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Steel Widget');
  });

  it('matches a fuzzy SKU subsequence', () => {
    render(<ProductCombobox products={PRODUCTS} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'gdt' } });
    expect(screen.getByRole('option')).toHaveTextContent('GDT-2002');
  });

  it('always shows BOTH sku and name, whichever field matched', () => {
    render(<ProductCombobox products={PRODUCTS} />);
    const input = screen.getByRole('combobox');

    // Matched by NAME → the SKU must still be visible.
    fireEvent.change(input, { target: { value: 'widget' } });
    expect(screen.getByRole('option')).toHaveTextContent('WGT-1001');
    expect(screen.getByRole('option')).toHaveTextContent('Steel Widget');

    // Matched by SKU → the NAME must still be visible.
    fireEvent.change(input, { target: { value: 'gdt' } });
    expect(screen.getByRole('option')).toHaveTextContent('GDT-2002');
    expect(screen.getByRole('option')).toHaveTextContent('Brass Gadget');
  });

  it('selects a product on click, setting the hidden productId', () => {
    render(<ProductCombobox products={PRODUCTS} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'gadget' } });
    fireEvent.click(screen.getByRole('option'));
    expect(hiddenId().value).toBe('p2');
  });

  it('selects the highlighted option via ArrowDown + Enter', () => {
    render(<ProductCombobox products={PRODUCTS} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'bolt' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(hiddenId().value).toBe('p3');
  });
});
