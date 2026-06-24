// ProductListRow (app/_features/products/ProductListRow) — jsdom (vitest default).
//
// One catalog row: when the caller may manage the catalog and the product is
// active, name / sku / price are inputs that auto-save on blur (no Save button);
// created_by (full uuid) and created_at are read-only. The server actions are
// mocked — we assert WHAT the row submits (a partial FormData) and what it
// renders, not the DB. Real persistence is proven by actions.test + the E2E suite.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({ updateProduct: vi.fn(), retireProduct: vi.fn() }));
vi.mock('./actions', () => actions);

import { ProductListRow } from './ProductListRow';

const baseProduct = {
  id: 'prod-1',
  name: 'Steel Widget',
  sku: 'SKU-1',
  priceCents: 1000,
  retired: false,
  createdBy: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderRow(product: Partial<typeof baseProduct> = {}, canManage = true) {
  return render(
    <table>
      <tbody>
        <ProductListRow product={{ ...baseProduct, ...product }} canManage={canManage} />
      </tbody>
    </table>,
  );
}

const lastFormData = (fn: typeof actions.updateProduct) =>
  fn.mock.calls.at(-1)?.[0] as FormData;

beforeEach(() => {
  actions.updateProduct.mockReset();
  actions.retireProduct.mockReset();
});
afterEach(cleanup);

describe('ProductListRow (manageable)', () => {
  it('seeds the inputs with the product values (price in dollars)', () => {
    renderRow();
    expect(screen.getByLabelText('Name for SKU-1')).toHaveValue('Steel Widget');
    expect(screen.getByLabelText('Price for SKU-1')).toHaveValue(10); // $10.00
  });

  it('shows the FULL created_by uuid (not truncated)', () => {
    renderRow();
    expect(
      screen.getByText('11111111-1111-4111-8111-111111111111'),
    ).toBeInTheDocument();
  });

  it('saves the name on blur (partial FormData: just name)', () => {
    renderRow();
    const name = screen.getByLabelText('Name for SKU-1');
    fireEvent.change(name, { target: { value: 'Brass Widget' } });
    fireEvent.blur(name);
    expect(actions.updateProduct).toHaveBeenCalledTimes(1);
    const fd = lastFormData(actions.updateProduct);
    expect(fd.get('id')).toBe('prod-1');
    expect(fd.get('name')).toBe('Brass Widget');
    expect(fd.has('sku')).toBe(false);
    expect(fd.has('priceCents')).toBe(false);
  });

  it('shows SKU as read-only text — never an input — even for a manager', () => {
    renderRow();
    expect(screen.queryByLabelText('SKU for SKU-1')).not.toBeInTheDocument();
    expect(screen.getByText('SKU-1')).toBeInTheDocument();
  });

  it('saves the price on blur converted to CENTS (partial: just priceCents)', () => {
    renderRow();
    const price = screen.getByLabelText('Price for SKU-1');
    fireEvent.change(price, { target: { value: '12.50' } });
    fireEvent.blur(price);
    const fd = lastFormData(actions.updateProduct);
    expect(fd.get('priceCents')).toBe('1250');
    expect(fd.has('name')).toBe(false);
  });

  it('does not save when a field is blurred without changing it', () => {
    renderRow();
    fireEvent.blur(screen.getByLabelText('Name for SKU-1'));
    fireEvent.blur(screen.getByLabelText('Price for SKU-1'));
    expect(actions.updateProduct).not.toHaveBeenCalled();
  });

  it('does not save an emptied required field (name)', () => {
    renderRow();
    const name = screen.getByLabelText('Name for SKU-1');
    fireEvent.change(name, { target: { value: '' } });
    fireEvent.blur(name);
    expect(actions.updateProduct).not.toHaveBeenCalled();
  });

  it('retires the product on click (FormData: just id)', () => {
    renderRow();
    fireEvent.click(screen.getByRole('button', { name: /retire/i }));
    expect(actions.retireProduct).toHaveBeenCalledTimes(1);
    expect(lastFormData(actions.retireProduct).get('id')).toBe('prod-1');
  });

  it('shows a retired product read-only (no inputs, no Retire) even for a manager', () => {
    renderRow({ retired: true });
    expect(screen.queryByLabelText('Name for SKU-1')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retire/i })).not.toBeInTheDocument();
    expect(screen.getByText('Retired')).toBeInTheDocument();
  });
});

describe('ProductListRow (read-only)', () => {
  it('renders plain values with no inputs and no retire control when canManage is false', () => {
    renderRow({}, false);
    expect(screen.queryByLabelText('Name for SKU-1')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Price for SKU-1')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retire/i })).not.toBeInTheDocument();
    const row = screen.getByTestId('product-row');
    expect(within(row).getByText('Steel Widget')).toBeInTheDocument();
    expect(within(row).getByText('$10.00')).toBeInTheDocument();
    expect(
      within(row).getByText('11111111-1111-4111-8111-111111111111'),
    ).toBeInTheDocument();
  });
});
