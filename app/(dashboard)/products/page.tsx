import {
  createProduct,
  getProducts,
  retireProduct,
  updateProduct,
} from '@/app/_features/products';
import { getSessionUser } from '@/lib/auth/session';
import { buildAbility } from '@/lib/permissions/ability';

/**
 * The products catalog — an all-authed-users surface (the nav entry is ungated).
 * Everyone reads the catalog (`getProducts` is RLS read-all); only an owner sees
 * the management controls. Authorization is enforced on BOTH sides: this in-page
 * `can('manage', 'Product')` check hides the create/edit/retire UI from members,
 * and each action re-guards its write with `withPermission` + the owner-only RLS
 * policy (the security boundary a hidden form could not bypass). The page render
 * is covered by the products E2E suite, a recorded deviation, rather than a unit
 * test for this async server component.
 */
export default async function ProductsPage() {
  const session = await getSessionUser();
  const canManage = buildAbility({
    userId: session?.userId,
    roles: session?.roles ?? [],
  }).can('manage', 'Product');

  const products = await getProducts();
  const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Products</h1>

      {canManage && (
        <form action={createProduct} className="flex flex-wrap gap-2">
          <input
            name="name"
            required
            aria-label="Product name"
            placeholder="Name"
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="sku"
            required
            aria-label="SKU"
            placeholder="SKU"
            className="w-40 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="priceCents"
            type="number"
            min={0}
            required
            aria-label="Price (cents)"
            placeholder="Price (cents)"
            className="w-40 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            Add product
          </button>
        </form>
      )}

      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">SKU</th>
            <th className="py-2 pr-4 font-medium">Price</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            {canManage && <th className="py-2 pr-4 font-medium">Manage</th>}
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <tr>
              <td colSpan={canManage ? 5 : 4} className="py-2 text-zinc-500">
                No products yet.
              </td>
            </tr>
          ) : (
            products.map((p) => (
              <tr key={p.id} data-testid="product-row">
                <td className="py-2 pr-4">{p.name}</td>
                <td className="py-2 pr-4">{p.sku}</td>
                <td className="py-2 pr-4">{usd(p.priceCents)}</td>
                <td className="py-2 pr-4 text-zinc-500">
                  {p.retired ? 'Retired' : 'Active'}
                </td>
                {canManage && (
                  <td className="flex flex-wrap items-center gap-2 py-2 pr-4">
                    {!p.retired && (
                      <>
                        <form action={updateProduct} className="flex gap-1">
                          <input type="hidden" name="id" value={p.id} />
                          <input
                            name="name"
                            defaultValue={p.name}
                            required
                            aria-label={`Edit name for ${p.sku}`}
                            className="w-28 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                          <input
                            name="sku"
                            defaultValue={p.sku}
                            required
                            aria-label={`Edit SKU for ${p.sku}`}
                            className="w-24 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                          <input
                            name="priceCents"
                            type="number"
                            min={0}
                            defaultValue={p.priceCents}
                            required
                            aria-label={`Edit price for ${p.sku}`}
                            className="w-24 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                          <button
                            type="submit"
                            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium"
                          >
                            Save
                          </button>
                        </form>
                        <form action={retireProduct}>
                          <input type="hidden" name="id" value={p.id} />
                          <button
                            type="submit"
                            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-red-700"
                          >
                            Retire
                          </button>
                        </form>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
