// LineItemRow (app/_features/orders/LineItemRow) — jsdom (vitest default).
//
// One editable order-line row: quantity and unit price are inputs that auto-save
// on blur (no Save button), the line total sits rightmost, and an active override
// shows the frozen list price struck-through. The server actions are mocked — we
// assert WHAT the row submits (a partial FormData) and what it renders, not the
// DB. Real persistence is proven by actions.test + the E2E suite.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({ updateLine: vi.fn(), removeLine: vi.fn() }));
vi.mock('./actions', () => actions);

import { LineItemRow } from './LineItemRow';

const baseLine = {
  id: 'line-1',
  orderId: 'order-1',
  lineNumber: 1,
  productName: 'Steel Widget',
  quantity: 3,
  listPriceCents: 1000,
  overridePriceCents: null as number | null,
};

function renderRow(line: Partial<typeof baseLine> = {}, canEdit = true) {
  return render(
    <table>
      <tbody>
        <LineItemRow line={{ ...baseLine, ...line }} canEdit={canEdit} />
      </tbody>
    </table>,
  );
}

const lastFormData = (fn: typeof actions.updateLine) =>
  fn.mock.calls.at(-1)?.[0] as FormData;

beforeEach(() => {
  actions.updateLine.mockReset();
  actions.removeLine.mockReset();
});
afterEach(cleanup);

describe('LineItemRow (editable)', () => {
  it('seeds the price box with the effective price in dollars and shows the line total', () => {
    renderRow();
    expect(screen.getByLabelText('Unit price for Steel Widget')).toHaveValue(10); // $10.00
    expect(screen.getByLabelText('Quantity for Steel Widget')).toHaveValue(3);
    expect(screen.getByText('$30.00')).toBeInTheDocument(); // 1000c × 3
  });

  it('uses the override (not the list) for the price box and total, and strikes the list price', () => {
    renderRow({ overridePriceCents: 800 });
    expect(screen.getByLabelText('Unit price for Steel Widget')).toHaveValue(8);
    expect(screen.getByText('$24.00')).toBeInTheDocument(); // 800c × 3
    const struck = screen.getByText('$10.00');
    expect(struck).toHaveClass('line-through');
  });

  it('does NOT strike a list price when there is no override', () => {
    renderRow();
    expect(screen.queryByText('$10.00')).not.toBeInTheDocument();
  });

  it('saves the quantity on blur (partial FormData: just quantity)', () => {
    renderRow();
    const qty = screen.getByLabelText('Quantity for Steel Widget');
    fireEvent.change(qty, { target: { value: '5' } });
    fireEvent.blur(qty);
    expect(actions.updateLine).toHaveBeenCalledTimes(1);
    const fd = lastFormData(actions.updateLine);
    expect(fd.get('id')).toBe('line-1');
    expect(fd.get('orderId')).toBe('order-1');
    expect(fd.get('quantity')).toBe('5');
    expect(fd.has('overridePriceCents')).toBe(false);
  });

  it('saves a price override on blur as CENTS (partial FormData: just override)', () => {
    renderRow();
    const price = screen.getByLabelText('Unit price for Steel Widget');
    fireEvent.change(price, { target: { value: '8.50' } });
    fireEvent.blur(price);
    expect(actions.updateLine).toHaveBeenCalledTimes(1);
    const fd = lastFormData(actions.updateLine);
    expect(fd.get('overridePriceCents')).toBe('850');
    expect(fd.has('quantity')).toBe(false);
  });

  it('clearing the price box and blurring sends an empty override (reverts to list)', () => {
    renderRow({ overridePriceCents: 800 });
    const price = screen.getByLabelText('Unit price for Steel Widget');
    fireEvent.change(price, { target: { value: '' } });
    fireEvent.blur(price);
    const fd = lastFormData(actions.updateLine);
    expect(fd.get('overridePriceCents')).toBe('');
  });

  it('does not save when a field is blurred without changing it', () => {
    renderRow();
    fireEvent.blur(screen.getByLabelText('Quantity for Steel Widget'));
    fireEvent.blur(screen.getByLabelText('Unit price for Steel Widget'));
    expect(actions.updateLine).not.toHaveBeenCalled();
  });
});

describe('LineItemRow (read-only)', () => {
  it('renders plain values with no inputs and no remove control when canEdit is false', () => {
    renderRow({}, false);
    expect(screen.queryByLabelText('Quantity for Steel Widget')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Unit price for Steel Widget')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    const row = screen.getByTestId('line-row');
    expect(within(row).getByText('$30.00')).toBeInTheDocument();
  });
});
