import { redirect } from 'next/navigation';

import {
  addLineItem,
  getOrder,
  getOrderLineItems,
  removeLineItem,
  updateLineItem,
} from '@/app/_features/orders';
import { getProducts } from '@/app/_features/products';
import { getSessionUser } from '@/lib/auth/session';

/**
 * Order detail + line-item editor. `getOrder` is RLS-scoped, so an order the
 * caller may not see resolves to undefined → bounce to the list. Line-item
 * controls show only on the caller's OWN order (`createdBy === session.userId`);
 * an owner viewing another rep's order reads it but cannot edit — the same split
 * the line-item RLS enforces at the row level (the controls are UX over that
 * boundary). Product names/prices come from the products dev-API and are joined
 * to the lines HERE, so orders never imports the products schema. Covered by the
 * orders E2E suite (recorded deviation), not a unit test for this async server
 * component.
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) redirect('/orders');

  const session = await getSessionUser();
  const canEdit = order.createdBy === session?.userId;

  const [lines, products] = await Promise.all([getOrderLineItems(id), getProducts()]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const active = products.filter((p) => !p.retired);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Order <span className="font-mono text-lg">{order.id.slice(0, 8)}</span>
      </h1>

      {canEdit && (
        <form action={addLineItem} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="orderId" value={order.id} />
          <label className="flex flex-col text-xs">
            Product
            <select
              name="productId"
              required
              aria-label="Product"
              className="w-56 rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              {active.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({usd(p.priceCents)})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs">
            Quantity
            <input
              name="quantity"
              type="number"
              min={1}
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
            <th className="py-2 pr-4 font-medium">Product</th>
            <th className="py-2 pr-4 font-medium">Qty</th>
            <th className="py-2 pr-4 font-medium">Line total</th>
            {canEdit && <th className="py-2 pr-4 font-medium">Edit</th>}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={canEdit ? 4 : 3} className="py-2 text-zinc-500">
                No line items yet.
              </td>
            </tr>
          ) : (
            lines.map((l) => {
              const product = byId.get(l.productId);
              return (
                <tr key={l.id} data-testid="line-row">
                  <td className="py-2 pr-4">{product?.name ?? l.productId.slice(0, 8)}</td>
                  <td className="py-2 pr-4">{l.quantity}</td>
                  <td className="py-2 pr-4">
                    {product ? usd(product.priceCents * l.quantity) : '—'}
                  </td>
                  {canEdit && (
                    <td className="flex flex-wrap items-center gap-2 py-2 pr-4">
                      <form action={updateLineItem} className="flex gap-1">
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="orderId" value={order.id} />
                        <input
                          name="quantity"
                          type="number"
                          min={1}
                          defaultValue={l.quantity}
                          required
                          aria-label={`Quantity for ${product?.name ?? l.productId}`}
                          className="w-20 rounded border border-zinc-300 px-2 py-1 text-xs"
                        />
                        <button
                          type="submit"
                          className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium"
                        >
                          Save
                        </button>
                      </form>
                      <form action={removeLineItem}>
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="orderId" value={order.id} />
                        <button
                          type="submit"
                          className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-red-700"
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
