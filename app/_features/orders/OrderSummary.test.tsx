// OrderSummary (app/_features/orders/OrderSummary) — jsdom.
//
// A read-only footer for the order detail page: how many line items, and the
// order total (the sum of line totals, formatted USD). Pure presentation over
// the priced lines — the arithmetic lives in pricing.ts (orderTotalCents).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { OrderSummary } from './OrderSummary';

afterEach(cleanup);

const twoLines = [
  { listPriceCents: 1000, overridePriceCents: null, quantity: 3 }, // $30.00
  { listPriceCents: 500, overridePriceCents: 400, quantity: 2 }, // $8.00
];

describe('OrderSummary', () => {
  it('shows the line count (plural)', () => {
    render(<OrderSummary lines={twoLines} />);
    expect(screen.getByTestId('order-line-count')).toHaveTextContent('2 line items');
  });

  it('shows the order total formatted in USD with thousands separators', () => {
    render(
      <OrderSummary
        lines={[{ listPriceCents: 123456, overridePriceCents: null, quantity: 10 }]}
      />,
    ); // $1,234.56 × 10 = $12,345.60
    expect(screen.getByTestId('order-total')).toHaveTextContent('$12,345.60');
  });

  it('reads "1 line item" (singular) for a single line', () => {
    render(<OrderSummary lines={[twoLines[0]]} />);
    expect(screen.getByTestId('order-line-count').textContent).toBe('1 line item');
  });

  it('shows 0 line items and $0.00 for an empty order', () => {
    render(<OrderSummary lines={[]} />);
    expect(screen.getByTestId('order-line-count').textContent).toBe('0 line items');
    expect(screen.getByTestId('order-total')).toHaveTextContent('$0.00');
  });
});
