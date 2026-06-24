/**
 * Products dev API (Iron Rule 8, ADR-0005) — the ONLY surface outsiders may
 * import; the boundary law (rule D) fails the build on anything deeper. Exactly
 * what the route page consumes, one deliberate export per line.
 *
 * NOT exported on purpose: the manifests `schema`/`permissions`/`nav` (the
 * registry's seam, rule C — never re-export manifests through the index). There
 * is no client island: a reference catalog needs no realtime.
 */
export {
  getProducts,
  createProduct,
  updateProduct,
  retireProduct,
  restoreProduct,
  type ProductRow,
  type CreateProductResult,
} from './actions';
export { ProductListRow, type ProductListRowData } from './ProductListRow';
export { ProductCreateForm } from './ProductCreateForm';
