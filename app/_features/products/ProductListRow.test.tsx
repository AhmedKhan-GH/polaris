// ProductListRow (app/_features/products/ProductListRow) — jsdom (vitest default).
//
// One catalog row: when the caller may manage the catalog and the product is
// active, name / sku / price are inputs that auto-save on blur (no Save button);
// created_by (full uuid) and created_at are read-only. The server actions are
// mocked — we assert WHAT the row submits (a partial FormData) and what it
// renders, not the DB. Real persistence is proven by actions.test + the E2E suite.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  updateProduct: vi.fn(),
  retireProduct: vi.fn(),
  restoreProduct: vi.fn(),
}));
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
  actions.restoreProduct.mockReset();
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

  it('saves the name on blur (partial FormData: just name)', async () => {
    renderRow();
    const name = screen.getByLabelText('Name for SKU-1');
    fireEvent.change(name, { target: { value: 'Brass Widget' } });
    fireEvent.blur(name);
    await waitFor(() => expect(actions.updateProduct).toHaveBeenCalledTimes(1));
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

  it('saves the price on blur in DOLLARS (partial FormData: just price)', async () => {
    renderRow();
    const price = screen.getByLabelText('Price for SKU-1');
    fireEvent.change(price, { target: { value: '12.50' } });
    fireEvent.blur(price);
    await waitFor(() => expect(actions.updateProduct).toHaveBeenCalledTimes(1));
    const fd = lastFormData(actions.updateProduct);
    expect(fd.get('price')).toBe('12.50');
    expect(fd.has('name')).toBe(false);
  });

  // The price box should snap to a fixed two-decimal display on blur and persist
  // exactly what it shows — a bare integer becomes `N.00`, a third decimal rounds.
  it('snaps a whole-dollar price to two decimals on blur and saves it that way', async () => {
    renderRow();
    const price = screen.getByLabelText('Price for SKU-1') as HTMLInputElement;
    fireEvent.change(price, { target: { value: '12' } });
    fireEvent.blur(price);
    expect(price.value).toBe('12.00');
    await waitFor(() => expect(actions.updateProduct).toHaveBeenCalledTimes(1));
    expect(lastFormData(actions.updateProduct).get('price')).toBe('12.00');
  });

  it('rounds a third-decimal price to the nearest cent on blur (12.999 → 13.00)', async () => {
    renderRow();
    const price = screen.getByLabelText('Price for SKU-1') as HTMLInputElement;
    fireEvent.change(price, { target: { value: '12.999' } });
    fireEvent.blur(price);
    expect(price.value).toBe('13.00');
    await waitFor(() => expect(actions.updateProduct).toHaveBeenCalledTimes(1));
    expect(lastFormData(actions.updateProduct).get('price')).toBe('13.00');
  });

  it('does not save when a re-typed price is equivalent to the seeded one (10 → 10.00)', () => {
    renderRow(); // seeded $10.00
    const price = screen.getByLabelText('Price for SKU-1') as HTMLInputElement;
    fireEvent.change(price, { target: { value: '10' } });
    fireEvent.blur(price);
    expect(price.value).toBe('10.00');
    expect(actions.updateProduct).not.toHaveBeenCalled();
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

  it('asks for confirmation before retiring — retires only after Confirm', () => {
    renderRow();
    fireEvent.click(screen.getByRole('button', { name: 'Retire' }));
    // A confirmation dialog appears; nothing retired yet.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(actions.retireProduct).not.toHaveBeenCalled();
    // Confirming executes the retire with just the id.
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(actions.retireProduct).toHaveBeenCalledTimes(1);
    expect(lastFormData(actions.retireProduct).get('id')).toBe('prod-1');
  });

  it('cancelling the confirmation closes the dialog and does not retire', () => {
    renderRow();
    fireEvent.click(screen.getByRole('button', { name: 'Retire' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(actions.retireProduct).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders a $ adornment outside the editable price input', () => {
    renderRow();
    const row = screen.getByTestId('product-row');
    expect(within(row).getByText('$')).toBeInTheDocument();
  });

  it('caps the editable name length at the input level (matching the server limit)', () => {
    renderRow();
    expect(screen.getByLabelText('Name for SKU-1')).toHaveAttribute('maxlength', '200');
  });

  it('shows a retired product read-only with a Restore action (no inputs, no Retire) for a manager', () => {
    renderRow({ retired: true });
    expect(screen.queryByLabelText('Name for SKU-1')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retire' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
    expect(screen.getByText('Retired')).toBeInTheDocument();
  });

  it('restores a retired product on click (FormData: just id, no confirmation)', () => {
    renderRow({ retired: true });
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(actions.restoreProduct).toHaveBeenCalledTimes(1);
    expect(lastFormData(actions.restoreProduct).get('id')).toBe('prod-1');
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

  it('formats the read-only price with thousands separators', () => {
    renderRow({ priceCents: 1234567 }, false); // $12,345.67
    expect(screen.getByText('$12,345.67')).toBeInTheDocument();
  });
});

// Inline edits auto-save on blur with no Save button, so a failed save (realistically
// the per-user write budget tripping on rapid edits) must NOT be silent: surface it,
// keep the typed value so the edit can be retried, and clear it once a save lands.
describe('ProductListRow (inline-save feedback)', () => {
  it('surfaces an error and keeps the typed value when an inline save fails', async () => {
    actions.updateProduct.mockRejectedValue(
      new Error('Rate limit exceeded. Retry in 5s'),
    );
    renderRow();
    const name = screen.getByLabelText('Name for SKU-1');
    fireEvent.change(name, { target: { value: 'Brass Widget' } });
    fireEvent.blur(name);

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t save/i);
    expect(name).toHaveValue('Brass Widget'); // retained so the edit isn't lost
  });

  it('clears the error once a later edit saves successfully', async () => {
    actions.updateProduct
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    renderRow();
    const price = screen.getByLabelText('Price for SKU-1');
    fireEvent.change(price, { target: { value: '12.50' } });
    fireEvent.blur(price);
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    fireEvent.change(price, { target: { value: '13.50' } });
    fireEvent.blur(price);
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    );
  });

  it('shows a saving indicator while an inline save is in flight', async () => {
    let release!: () => void;
    actions.updateProduct.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    renderRow();
    const name = screen.getByLabelText('Name for SKU-1');
    fireEvent.change(name, { target: { value: 'Brass Widget' } });
    fireEvent.blur(name);

    expect(await screen.findByText(/saving/i)).toBeInTheDocument();
    release();
    await waitFor(() =>
      expect(screen.queryByText(/saving/i)).not.toBeInTheDocument(),
    );
  });
});
