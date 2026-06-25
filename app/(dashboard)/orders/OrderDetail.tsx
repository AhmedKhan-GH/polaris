import { redirect } from 'next/navigation';

import {
  LineItemRow,
  OrderSummary,
  ProductCombobox,
  addLine,
  getAllowedTransitions,
  getOrder,
  getOrderLines,
  transitionOrder,
  type OrderStatus,
} from '@/app/_features/orders';
import { getProducts } from '@/app/_features/products';
import { getSessionUser } from '@/lib/auth/session';

/**
 * Order detail + native line-item intake, as a REUSABLE composition component —
 * NOT a feature export. It composes the orders AND products dev-APIs, which only
 * a composition-layer file (outside `app/_features/`) may do (import-boundary
 * rule B). Rendered full-screen by the `/orders/[id]` route today, and reused
 * inside the orders console's status work panel — one implementation, two mount
 * points.
 *
 * `getOrder` is RLS-scoped, so an order the caller may not see resolves to
 * undefined → bounce to the list. Line edits render only when the caller may
 * write the order (member: own draft; owner/admin: any non-terminal). Transition
 * buttons come from `getAllowedTransitions(roles, status)`. Adding a line reads
 * the product's CURRENT price here and passes it to `addLine` as the
 * `list_price_cents` snapshot — so line totals never shift when the catalog price
 * later changes. Covered by the orders E2E suite.
 */
export async function OrderDetail({ orderId }: { orderId: string }) {
  const order = await getOrder(orderId);
  if (!order) redirect('/orders');

  const session = await getSessionUser();
  const roles = session?.roles ?? [];
  const privileged = roles.includes('owner') || roles.includes('admin');
  const ownsOrder = order.createdBy === session?.userId;
  const terminal = order.status === 'completed' || order.status === 'cancelled';
  const canEditLines =
    !terminal && (privileged || (ownsOrder && order.status === 'draft'));
  const allowed = getAllowedTransitions(roles, order.status as OrderStatus);

  const [lines, products] = await Promise.all([
    getOrderLines(orderId),
    getProducts(),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const active = products.filter((p) => !p.retired);
  // The button verb for each transition TARGET (draft as a target = recall).
  const actionLabels: Record<OrderStatus, string> = {
    draft: 'Recall to draft',
    submitted: 'Submit',
    processing: 'Process',
    completed: 'Complete',
    cancelled: 'Cancel',
  };
  // Semantic status chip — explicit bg + text so it reads on dark or light.
  const statusChip: Record<OrderStatus, string> = {
    draft: 'bg-zinc-200 text-zinc-800',
    submitted: 'bg-blue-100 text-blue-800',
    processing: 'bg-amber-100 text-amber-900',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  async function addLineAction(formData: FormData) {
    'use server';
    const productId = String(formData.get('productId') ?? '');
    if (!productId) return; // no product picked (the combobox also `required`s one) — nothing to add
    const product = (await getProducts()).find((p) => p.id === productId);
    if (!product) throw new Error('Unknown product');
    await addLine({
      orderId,
      productId,
      quantity: Number(formData.get('quantity') ?? '0'),
      listPriceCents: product.priceCents,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Order <span className="font-mono text-lg">#{order.orderNumber}</span>
        </h1>
        <span
          data-testid="order-status"
          className={`rounded-full px-3 py-1 text-sm font-medium ${statusChip[order.status as OrderStatus] ?? 'bg-zinc-200 text-zinc-800'}`}
        >
          {order.status}
        </span>
      </div>

      {allowed.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="transitions">
          {allowed.map((to) => (
            <form key={to} action={transitionOrder}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="to" value={to} />
              <button
                type="submit"
                className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium"
              >
                {actionLabels[to]}
              </button>
            </form>
          ))}
        </div>
      )}

      {canEditLines && (
        <form action={addLineAction} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col text-xs">
            Product
            <ProductCombobox products={active} />
          </div>
          <label className="flex flex-col text-xs">
            Quantity
            <input
              name="quantity"
              type="number"
              min={1}
              step={1}
              defaultValue={1}
              required
              aria-label="Quantity"
              className="w-24 rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            Add line
          </button>
        </form>
      )}

      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2 pr-4 font-medium">#</th>
            <th className="py-2 pr-4 font-medium">Product</th>
            <th className="py-2 pr-4 font-medium">Qty</th>
            <th className="py-2 pr-4 font-medium">Unit price</th>
            <th className="py-2 pr-4 font-medium">Line total</th>
            {canEditLines && <th className="py-2 pr-4 font-medium" />}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={canEditLines ? 6 : 5} className="py-2 text-zinc-500">
                No line items yet.
              </td>
            </tr>
          ) : (
            lines.map((l, index) => (
              <LineItemRow
                key={l.id}
                canEdit={canEditLines}
                line={{
                  id: l.id,
                  orderId: order.id,
                  // Display the row's POSITION, not the stored line_number — so the
                  // numbers stay contiguous (1..N) after a line is removed. The
                  // stored line_number is just a gap-tolerant ordering key.
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
    </div>
  );
}
