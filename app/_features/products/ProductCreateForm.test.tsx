// ProductCreateForm (app/_features/products/ProductCreateForm) — jsdom.
//
// The owner-only catalog create form. It submits a DOLLARS price and surfaces
// the result `createProduct` returns — a validation error or a DUPLICATE SKU —
// inline, keeping the entered values so the owner can fix and resubmit. The
// server action is mocked; we assert what the form submits and that it renders
// the returned error.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({ createProduct: vi.fn() }));
vi.mock('./actions', () => actions);

import { ProductCreateForm } from './ProductCreateForm';

function fill() {
  fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Widget' } });
  fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'SKU-1' } });
  fireEvent.change(screen.getByLabelText('Price ($)'), { target: { value: '19.99' } });
}

beforeEach(() => actions.createProduct.mockReset());
afterEach(cleanup);

describe('ProductCreateForm', () => {
  it('submits name, sku and a DOLLARS price to createProduct', async () => {
    actions.createProduct.mockResolvedValue({});
    render(<ProductCreateForm />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: /add product/i }));

    await waitFor(() => expect(actions.createProduct).toHaveBeenCalledTimes(1));
    const fd = actions.createProduct.mock.calls[0][0] as FormData;
    expect(fd.get('name')).toBe('Widget');
    expect(fd.get('sku')).toBe('SKU-1');
    expect(fd.get('price')).toBe('19.99');
  });

  it('surfaces the error returned by createProduct (e.g. duplicate SKU)', async () => {
    actions.createProduct.mockResolvedValue({
      error: 'A product with SKU "SKU-1" already exists',
    });
    render(<ProductCreateForm />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: /add product/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i);
  });

  it('renders a $ adornment outside the price input', () => {
    render(<ProductCreateForm />);
    expect(screen.getByText('$')).toBeInTheDocument();
  });

  it('caps name and sku length at the input level (matching the server limits)', () => {
    render(<ProductCreateForm />);
    expect(screen.getByLabelText('Product name')).toHaveAttribute('maxlength', '200');
    expect(screen.getByLabelText('SKU')).toHaveAttribute('maxlength', '100');
  });

  it('shows no error after a successful submit', async () => {
    actions.createProduct.mockResolvedValue({});
    render(<ProductCreateForm />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: /add product/i }));

    await waitFor(() => expect(actions.createProduct).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
