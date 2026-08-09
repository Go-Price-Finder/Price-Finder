/**
 * Generates a SQL upsert file for public.products from the real partner
 * catalog (lib/partners.ts), so wishlists (public.wishlists.product_id)
 * can reference real products instead of only the legacy mock catalog.
 * Run once as a backfill and re-run after any partner import/re-import to
 * keep the DB in sync — writes SQL to scratch/, doesn't touch the DB
 * itself (no Supabase credentials needed here; the SQL is applied
 * separately via the Supabase MCP / dashboard SQL editor).
 *
 * After applying the generated SQL, assert coverage per step 8 of
 * claude/post-import-verification-runbook.md — generating and applying the
 * files is not the same as confirming every catalog row landed.
 *
 * Run with: npx tsx scripts/sync-products-to-supabase.ts
 */
import { writeFileSync } from "fs";
import { PARTNERS } from "../lib/partners";

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

const CHUNK_SIZE = 80;

// Every partner, always — deliberately not a subset. This used to filter to
// ["golden-maple", "tsar-bomba"], the two partners left to backfill at the
// time it was written. That made it silently emit nothing for any other
// partner, so a later import would appear to run fine while producing no SQL
// at all — and the missing public.products rows only surface later as
// foreign-key failures when refresh-prices writes current_prices. Re-scoping
// this to a subset is how that failure mode comes back; filter at the point
// of use (skip the files you don't need) rather than here.
for (const partner of PARTNERS) {
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
