import type { OrderRow } from './actions';
import { ORDER_STATUSES, type OrderStatus } from './transitions';

/**
 * Bucket orders into one list per status, keyed in canonical `ORDER_STATUSES`
 * order — the stable column order the console's board and status views render.
 * Every status is present; empty statuses map to `[]`. Order WITHIN a bucket is
 * preserved from the input (callers pass newest-first from `getOrders`).
 */
export function groupOrdersByStatus(
  orders: OrderRow[],
): Record<OrderStatus, OrderRow[]> {
  const grouped = Object.fromEntries(
    ORDER_STATUSES.map((status) => [status, [] as OrderRow[]]),
  ) as Record<OrderStatus, OrderRow[]>;
  for (const order of orders) {
    // `?.` keeps an unexpected status (shouldn't occur — the DB CHECK constrains
    // it) from creating a non-canonical bucket.
    grouped[order.status as OrderStatus]?.push(order);
  }
  return grouped;
}
