import {
  ProductCreateForm,
  ProductListRow,
  getProducts,
  type ProductRow,
} from '@/app/_features/products';
import { getSessionUser } from '@/lib/auth/session';
import { buildAbility } from '@/lib/permissions/ability';

/** A catalog table (header + rows), shared by the active and retired lists. */
function ProductTable({
  rows,
  canManage,
  emptyText,
}: {
  rows: ProductRow[];
  canManage: boolean;
  emptyText: string;
}) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr>
          <th className="py-2 pr-4 font-medium">Name</th>
          <th className="py-2 pr-4 font-medium">SKU</th>
          <th className="py-2 pr-4 font-medium">Price</th>
          <th className="py-2 pr-4 font-medium">Status</th>
          <th className="py-2 pr-4 font-medium">Created by</th>
          <th className="py-2 pr-4 font-medium">Created (UTC)</th>
          {canManage && <th className="py-2 pr-4 font-medium">Manage</th>}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={canManage ? 7 : 6} className="py-2 text-zinc-500">
              {emptyText}
            </td>
          </tr>
        ) : (
          rows.map((p) => (
            <ProductListRow
              key={p.id}
              product={{ ...p, createdAt: p.createdAt.toISOString() }}
              canManage={canManage}
            />
          ))
        )}
      </tbody>
    </table>
  );
}

/**
 * The products catalog — an all-authed-users surface (the nav entry is ungated).
 * Everyone reads the catalog (`getProducts` is RLS read-all); only an owner sees
 * the management controls. Authorization is enforced on BOTH sides: this in-page
 * `can('manage', 'Product')` check hides the create/edit/retire UI from members,
 * and each action re-guards its write with `withPermission` + the owner-only RLS
 * policy (the security boundary a hidden form could not bypass).
 *
 * Active and retired products are shown as SEPARATE lists. Retiring is a
 * reversible hide, so the retired list (with a Restore action) is shown only to
 * managers — to everyone else a retired product is simply absent. The page render
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
  const active = products.filter((p) => !p.retired);
  const retired = products.filter((p) => p.retired);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Products</h1>

      {canManage && <ProductCreateForm />}

      <ProductTable rows={active} canManage={canManage} emptyText="No products yet." />

      {canManage && retired.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium tracking-tight text-zinc-600">
            Retired
          </h2>
          <ProductTable rows={retired} canManage={canManage} emptyText="" />
        </section>
      )}
    </div>
  );
}
