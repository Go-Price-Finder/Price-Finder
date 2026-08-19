/**
 * One-shot catalog_products sync for the aaawave tranche-1 import
 * (2026-08-19, 500 GTIN-bearing products from AWIN feed F2639).
 *
 * Unlike scripts/backfill-catalog-products.ts (which writes SQL files for
 * manual application and predates the gtin column), this writes directly
 * via the service-role client and includes gtin — the whole point of this
 * tranche is the cross-network GTIN join, so the identifier must land in
 * the same step as the rows it identifies.
 *
 * gtin comes from the RAW data file (lib/aaawave-data.ts): normalizeProduct
 * strips it, so the normalized PARTNERS entry alone can't supply it. Rows
 * are joined raw→normalized by slug, which the importer guarantees unique
 * within a partner.
 *
 * Run with: npx tsx --env-file=.env.local scripts/sync-aaawave-catalog.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types";
import { PARTNERS } from "../lib/partners";
import { AAAWAVE_PRODUCTS } from "../lib/aaawave-data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const supabase = createClient<Database>(url, serviceRoleKey, {
  auth: { persistSession: false },
});

async function main() {
  const partner = PARTNERS.find((p) => p.id === "aaawave");
  if (!partner) {
    console.error("aaawave not found in PARTNERS — run the importer first.");
    process.exit(1);
  }

  const gtinBySlug = new Map(AAAWAVE_PRODUCTS.map((p) => [p.slug, p.gtin ?? null]));

  const rows = partner.products.map((p, idx) => ({
    id: p.id,
    partner_id: p.partnerId,
    slug: p.slug,
    name: p.name,
    description: p.description,
    price: p.price,
    original_price: p.originalPrice ?? null,
    image: p.image,
    images: p.images,
    category: p.category,
    parent_category: p.parentCategory,
    badge: p.badge ?? null,
    rating_stars: p.rating?.stars ?? null,
    rating_count: p.rating?.count ?? null,
    deep_link: p.deepLink,
    variant_label: p.variantLabel ?? null,
    sort_order: idx + 1,
    gtin: gtinBySlug.get(p.slug) ?? null,
  }));

  const missingGtin = rows.filter((r) => r.gtin === null).length;
  console.log(`Prepared ${rows.length} rows (${missingGtin} without gtin — tranche selection was GTIN-bearing, expect 0).`);

  const CHUNK = 100;
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from("catalog_products").upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error(`Chunk at offset ${i} failed: ${error.code} ${error.message}`);
      process.exit(1);
    }
    written += chunk.length;
    console.log(`  upserted ${written}/${rows.length}`);
  }

  // Read-back verification: count + gtin coverage from the live table.
  const { count, error: countErr } = await supabase
    .from("catalog_products")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", "aaawave");
  const { count: gtinCount, error: gtinErr } = await supabase
    .from("catalog_products")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", "aaawave")
    .not("gtin", "is", null);
  if (countErr || gtinErr) {
    console.error("Read-back failed:", countErr?.message ?? gtinErr?.message);
    process.exit(1);
  }
  console.log(`Live table: ${count} aaawave rows, ${gtinCount} with gtin.`);
}

main();
