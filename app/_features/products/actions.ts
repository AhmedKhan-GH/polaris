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
 * Catalog fields validated at the action boundary. Price is entered in DOLLARS
 * (a two-decimal money field) and stored as integer cents — `priceField` coerces
 * the dollar value, rejects anything below zero, and rounds to the nearest cent.
 * `sku` is the unique stock key. Messages surface to the caller verbatim. The DB
 * is the backstop: a duplicate `sku` trips the UNIQUE constraint (surfaced by
 * `createProduct` as a friendly error), and owner-only RLS forbids any non-owner
 * write regardless.
 */
const nameField = z
  .string()
  .min(1, 'Product name is required')
  .max(200, 'Product name too long');
const skuField = z.string().min(1, 'SKU is required').max(100, 'SKU too long');
const priceField = z.coerce
  .number()
  .min(0, 'Price must be $0.00 or more')
  .transform((dollars) => Math.round(dollars * 100));
const idField = z.string().uuid('Invalid product id');

const createSchema = z.object({
  name: nameField,
  sku: skuField,
  priceCents: priceField,
});

/** Postgres `unique_violation` (SQLSTATE 23505) — a duplicate SKU on insert. */
function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === '23505' || err?.cause?.code === '23505';
}

export type CreateProductResult = { error?: string };

export type ProductRow = {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  retired: boolean;
  createdBy: string;
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
 * validate → context, then revalidate ONLY on success. Returns a result rather
 * than throwing for the two caller-correctable cases — a validation failure or a
 * DUPLICATE SKU (unique-constraint violation) — so the create form can surface
 * the message inline; the guard, limiter, and unexpected DB errors still throw.
 * The guard requires `create Product` (owner-only); owner-write RLS is the
 * independent backstop.
 */
export async function createProduct(
  formData: FormData,
): Promise<CreateProductResult> {
  return withPermission('create', 'Product', (ctx) =>
    withRateLimit(productsWriteLimiter, `products:create:${ctx.userId}`, async () => {
      const parsed = createSchema.safeParse({
        name: String(formData.get('name') ?? ''),
        sku: String(formData.get('sku') ?? ''),
        priceCents: String(formData.get('price') ?? ''),
      });
      if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? 'Invalid product' };
      }
      try {
        await withUserContext(ctx, (tx) =>
          tx.insert(products).values({ ...parsed.data, createdBy: ctx.userId }),
        );
      } catch (e) {
        if (isUniqueViolation(e)) {
          return { error: `A product with SKU "${parsed.data.sku}" already exists` };
        }
        throw e;
      }
      revalidatePath('/products');
      return {};
    }),
  );
}

/**
 * Edit a product in place — a PARTIAL update of whichever fields the form sends
 * (name / sku / price), so the inline list cells can each auto-save on blur
 * independently. Price arrives in DOLLARS and is stored as cents. Same guard
 * chain as create, with `update Product`; the `id` is validated as a uuid before
 * any write.
 */
export async function updateProduct(formData: FormData): Promise<void> {
  await withPermission('update', 'Product', (ctx) =>
    withRateLimit(productsWriteLimiter, `products:update:${ctx.userId}`, async () => {
      const id = idField.parse(String(formData.get('id') ?? ''));

      const set: { name?: string; sku?: string; priceCents?: number } = {};
      if (formData.has('name')) {
        set.name = nameField.parse(String(formData.get('name') ?? ''));
      }
      if (formData.has('sku')) {
        set.sku = skuField.parse(String(formData.get('sku') ?? ''));
      }
      if (formData.has('price')) {
        set.priceCents = priceField.parse(String(formData.get('price') ?? ''));
      }

      await withUserContext(ctx, (tx) =>
        tx.update(products).set(set).where(eq(products.id, id)),
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

/**
 * Restore a retired product — the reverse of `retireProduct` (`retired = false`),
 * bringing it back into the active catalog and the line-item picker. Retiring is
 * therefore a reversible HIDE, not a permanent delete. Guarded by `update Product`
 * (a lifecycle flip); owner-only RLS is the backstop.
 */
export async function restoreProduct(formData: FormData): Promise<void> {
  await withPermission('update', 'Product', (ctx) =>
    withRateLimit(productsWriteLimiter, `products:restore:${ctx.userId}`, async () => {
      const id = idField.parse(String(formData.get('id') ?? ''));
      await withUserContext(ctx, (tx) =>
        tx.update(products).set({ retired: false }).where(eq(products.id, id)),
      );
    }),
  );

  revalidatePath('/products');
}
