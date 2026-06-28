import Link from 'next/link';

import {
  LineItemRow,
  OrderSummary,
  getOrder,
  getOrderLines,
} from '@/app/_features/orders';
import { getProducts } from '@/app/_features/products';

import { statusTones } from './statusTones';

/**
 * Read-only order preview — the glance panel the List and Board views show for
 * the `?selected` order. A composition component (orders + products dev-APIs,
 * like OrderDetail) but with NO edit controls: line items render read-only
 * (`LineItemRow canEdit={false}`), no transitions, no add-line. "Open" links to
 * the full `/orders/[id]` page to actually edit. Returns null when the id
 * resolves to no visible order (RLS) so the panel just shows nothing.
 */
export async function OrderPreview({ orderId }: { orderId: string }) {
  const order = await getOrder(orderId);
  if (!order) return null;
  const [lines, products] = await Promise.all([
    getOrderLines(orderId),
    getProducts(),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));

  return (
    <div data-testid="order-preview" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Order <span className="font-mono">#{order.orderNumber}</span>
        </h2>
        <span
          data-testid="preview-status"
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTones[order.status] ?? 'bg-zinc-200 text-zinc-800'}`}
        >
          {order.status}
        </span>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-1 pr-4 font-medium">#</th>
            <th className="py-1 pr-4 font-medium">Product</th>
            <th className="py-1 pr-4 font-medium">Qty</th>
            <th className="py-1 pr-4 font-medium">Unit price</th>
            <th className="py-1 pr-4 font-medium">Line total</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-1 text-zinc-500">
                No line items.
              </td>
            </tr>
          ) : (
            lines.map((l, index) => (
              <LineItemRow
                key={l.id}
                canEdit={false}
                line={{
                  id: l.id,
                  orderId: order.id,
                  lineNumber: index + 1,
                  productName: byId.get(l.productId)?.name ?? l.productId.slice(0, 8),
                  quantity: l.quantity,
                  listPriceCents: l.listPriceCents,
                  overridePriceCents: l.overridePriceCents,
                }}
              />
            ))
          )}
        </tbody>
      </table>

      <OrderSummary lines={lines} />

      <Link
        href={`/orders/${order.id}`}
        className="text-sm font-medium text-blue-700 underline"
      >
        Open full page →
      </Link>
    </div>
  );
}
