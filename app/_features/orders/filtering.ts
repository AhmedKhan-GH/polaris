import type { OrderRow } from './actions';

export interface OrderFilters {
  /** Keep only this status (blank/undefined = any). */
  status?: string;
  /** Keep orders created on/after this UTC day, `YYYY-MM-DD` (blank = no lower bound). */
  from?: string;
  /** Keep orders created on/before this UTC day, `YYYY-MM-DD` (blank = no upper bound). */
  to?: string;
}

/**
 * Filter the orders the console already fetched, by status and/or created-date
 * range — the List view's filter bar. Dates compare on the UTC day string
 * (`YYYY-MM-DD`), so both ends are inclusive of the whole day and timezone-stable.
 * Pure; the server-side/paginated form arrives with pagination later.
 */
export function filterOrders(orders: OrderRow[], filters: OrderFilters): OrderRow[] {
  const { status, from, to } = filters;
  return orders.filter((order) => {
    if (status && order.status !== status) return false;
    if (from || to) {
      const day = order.createdAt.toISOString().slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
    }
    return true;
  });
}
