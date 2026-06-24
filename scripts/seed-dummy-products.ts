import pg from 'pg';

/**
 * DEV-ONLY dummy catalog: a spread of products so the line-item intake (fuzzy
 * SKU search) has something to search. Library-only — the reusable verb is
 * `seedDummyProducts`, which the umbrella `db:seed-dev` calls alongside the demo
 * users (there is no standalone products-only command).
 *
 * Deliberately NOT wired into `db:setup` or the e2e `global-setup`: those keep
 * the products table controlled (the products E2E asserts exact counts), so dummy
 * data must be opt-in. Idempotent — re-running inserts only SKUs that are missing.
 */
const CATEGORIES = [
  { prefix: 'WGT', noun: 'Widget' },
  { prefix: 'GDT', noun: 'Gadget' },
  { prefix: 'BLT', noun: 'Bolt' },
  { prefix: 'NUT', noun: 'Hex Nut' },
  { prefix: 'WSR', noun: 'Washer' },
  { prefix: 'BRG', noun: 'Bearing' },
  { prefix: 'VLV', noun: 'Valve' },
  { prefix: 'PMP', noun: 'Pump' },
  { prefix: 'GSK', noun: 'Gasket' },
  { prefix: 'CPL', noun: 'Coupler' },
  { prefix: 'FLG', noun: 'Flange' },
  { prefix: 'BRK', noun: 'Bracket' },
];
const MATERIALS = ['Steel', 'Brass', 'Copper', 'Aluminum', 'Nylon'];
const SIZES = ['M6', 'M8', 'M10', '1/4in', '1/2in'];

export function buildDummyProducts(): { sku: string; name: string; priceCents: number }[] {
  const products: { sku: string; name: string; priceCents: number }[] = [];
  let n = 1000;
  for (const cat of CATEGORIES) {
    for (let i = 0; i < 4; i += 1) {
      n += 1;
      const material = MATERIALS[n % MATERIALS.length];
      const size = SIZES[(n + i) % SIZES.length];
      products.push({
        sku: `${cat.prefix}-${n}`,
        name: `${material} ${cat.noun} ${size}`,
        priceCents: 50 + ((n * 37) % 5000),
      });
    }
  }
  return products;
}

/**
 * Upsert the dummy catalog under the privileged role, returning the resulting
 * row count. Idempotent (`on conflict (sku) do nothing`).
 */
export async function seedDummyProducts(adminUrl: string): Promise<number> {
  const pool = new pg.Pool({ connectionString: adminUrl });
  try {
    for (const p of buildDummyProducts()) {
      await pool.query(
        `insert into products (name, sku, price_cents) values ($1, $2, $3)
           on conflict (sku) do nothing`,
        [p.name, p.sku, p.priceCents],
      );
    }
    const { rows } = await pool.query('select count(*)::int as n from products');
    return rows[0].n as number;
  } finally {
    await pool.end();
  }
}
