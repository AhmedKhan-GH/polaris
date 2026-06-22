'use server';

import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { withUserContext } from '@/lib/db/with-user-context';
import { withPermission } from '@/lib/permissions/guard';
import { createRateLimiter, withRateLimit } from '@/lib/rate-limit';

import { products } from './schema';

/**
 * Write budget for the catalog, OWNED by this feature (Charter D6): the
 * foundation manufactures limiters but holds none. 30 writes / 60s per acting
 * user, shared across create/update/retire.
 */
const productsWriteLimiter = createRateLimiter({ points: 30, duration: 60 });

/**
 * Catalog fields validated at the action boundary. `priceCents` is coerced from
 * the form string and must be a non-negative integer (the DB stores cents, never
 * a float); `sku` is the unique stock key. Messages surface to the caller
 * verbatim. The DB layer is the backstop: a duplicate `sku` trips the UNIQUE
 * constraint, and the owner-only RLS forbids any non-owner write regardless.
 */
const nameField = z
  .string()
  .min(1, 'Product name is required')
  .max(200, 'Product name too long');
const skuField = z.string().min(1, 'SKU is required').max(100, 'SKU too long');
const priceCentsField = z.coerce
  .number()
  .int('Price must be a non-negative whole number of cents')
  .min(0, 'Price must be a non-negative whole number of cents');
const idField = z.string().uuid('Invalid product id');

const createSchema = z.object({
  name: nameField,
  sku: skuField,
  priceCents: priceCentsField,
});
const updateSchema = createSchema.extend({ id: idField });

export type ProductRow = {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  retired: boolean;
  createdAt: Date;
};

/**
 * Read the whole catalog, newest first. Guarded by CASL (`read Product`) AND
 * scoped by Postgres RLS — but the products read policy is unconditional, so
 * every signed-in caller sees every row (members need the line-item picker).
 * Retired rows are returned too; the picker/UI decides what to show.
 */
export async function getProducts(): Promise<ProductRow[]> {
  return withPermission('read', 'Product', (ctx) =>
    withUserContext(ctx, (tx) =>
      tx.select().from(products).orderBy(desc(products.createdAt)),
    ),
  );
}

/**
 * Create a catalog product. Pipeline order is CONTRACTUAL: guard → limiter →
 * validate → context, then revalidate ONLY on success — never on a denied,
 * throttled, or invalid call. The guard requires `create Product` (owner-only
 * via `productsAbilities`); the owner-write RLS policy is the independent
 * backstop.
 */
export async function createProduct(formData: FormData): Promise<void> {
  await withPermission('create', 'Product', (ctx) =>
    withRateLimit(productsWriteLimiter, `products:create:${ctx.userId}`, async () => {
      const values = createSchema.parse({
        name: String(formData.get('name') ?? ''),
        sku: String(formData.get('sku') ?? ''),
        priceCents: String(formData.get('priceCents') ?? ''),
      });
      await withUserContext(ctx, (tx) => tx.insert(products).values(values));
    }),
  );

  revalidatePath('/products');
}

/**
 * Edit a product's name, sku, and price. Same guard chain as create, with
 * `update Product`; the `id` is validated as a uuid before any write.
 */
export async function updateProduct(formData: FormData): Promise<void> {
  await withPermission('update', 'Product', (ctx) =>
    withRateLimit(productsWriteLimiter, `products:update:${ctx.userId}`, async () => {
      const { id, ...values } = updateSchema.parse({
        id: String(formData.get('id') ?? ''),
        name: String(formData.get('name') ?? ''),
        sku: String(formData.get('sku') ?? ''),
        priceCents: String(formData.get('priceCents') ?? ''),
      });
      await withUserContext(ctx, (tx) =>
        tx.update(products).set(values).where(eq(products.id, id)),
      );
    }),
  );

  revalidatePath('/products');
}

/**
 * Retire a product — a SOFT delete (`retired = true`) so orders that reference
 * it keep their link; the picker filters retired rows out. Guarded by
 * `delete Product` (the verb retiring stands in for).
 */
export async function retireProduct(formData: FormData): Promise<void> {
  await withPermission('delete', 'Product', (ctx) =>
    withRateLimit(productsWriteLimiter, `products:retire:${ctx.userId}`, async () => {
      const id = idField.parse(String(formData.get('id') ?? ''));
      await withUserContext(ctx, (tx) =>
        tx.update(products).set({ retired: true }).where(eq(products.id, id)),
      );
    }),
  );

  revalidatePath('/products');
}
