/**
 * Generates a SQL upsert file for public.products from the real partner
 * catalog (lib/partners.ts), so wishlists (public.wishlists.product_id)
 * can reference real products instead of only the legacy mock catalog.
 * Run once as a backfill and re-run after any partner import/re-import to
 * keep the DB in sync — writes SQL to scratch/, doesn't touch the DB
 * itself (no Supabase credentials needed here; the SQL is applied
 * separately via the Supabase MCP / dashboard SQL editor).
 *
 * Run with: npx tsx scripts/sync-products-to-supabase.ts
 */
import { writeFileSync } from "fs";
import { PARTNERS } from "../lib/partners";

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

const CHUNK_SIZE = 80;
const remaining = PARTNERS.filter((p) => ["golden-maple", "tsar-bomba"].includes(p.id));

for (const partner of remaining) {
  for (let i = 0; i < partner.products.length; i += CHUNK_SIZE) {
    const chunk = partner.products.slice(i, i + CHUNK_SIZE);
    const values = chunk
      .map((p) => `('${sqlEscape(p.id)}','${sqlEscape(p.name)}','${sqlEscape(p.category)}','${sqlEscape(p.image)}')`)
      .join(",\n");

    const sql = `insert into public.products (id, name, category, image_url)
values
${values}
on conflict (id) do update set name=excluded.name, category=excluded.category, image_url=excluded.image_url;
`;

    const part = Math.floor(i / CHUNK_SIZE) + 1;
    const path = `scratch/sync-${partner.id}-p${part}.sql`;
    writeFileSync(path, sql, "utf-8");
    console.log(`Wrote ${chunk.length} products to ${path}`);
  }
}
