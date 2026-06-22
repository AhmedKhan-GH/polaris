import { config as loadEnv } from 'dotenv';
import pg from 'pg';

/**
 * DEV-ONLY: populate the catalog with a spread of dummy products so the
 * line-item intake (fuzzy SKU search) has something to search. Run manually:
 *
 *   npm run db:seed-products
 *
 * Deliberately NOT wired into `db:setup` or the e2e `global-setup`: those keep
 * the products table controlled (the products E2E asserts exact counts), so dummy
 * data must be opt-in. Idempotent — re-running inserts only SKUs that are missing.
 */
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env.test' });

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

function buildDummyProducts(): { sku: string; name: string; priceCents: number }[] {
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

async function main(): Promise<void> {
  const url = process.env.MIGRATE_DATABASE_URL;
  if (!url) {
    throw new Error(
      'MIGRATE_DATABASE_URL is not set — seed-dummy-products needs the privileged ' +
        'connection string (check .env.local / .env.test).',
    );
  }
  const pool = new pg.Pool({ connectionString: url });
  try {
    const products = buildDummyProducts();
    for (const p of products) {
      await pool.query(
        `insert into products (name, sku, price_cents) values ($1, $2, $3)
           on conflict (sku) do nothing`,
        [p.name, p.sku, p.priceCents],
      );
    }
    const { rows } = await pool.query('select count(*)::int as n from products');
    console.log(
      `seed-dummy-products ✓ upserted ${products.length} dummy SKUs; products now has ${rows[0].n} rows`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
