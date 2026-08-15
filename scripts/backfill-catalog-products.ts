/**
 * Step 1 of the catalog/search/onboarding migration
 * (claude/catalog-search-onboarding-migration-scope-2026-08-03.md,
 * Section 3, "Step 1 — Backfill, read-only").
 *
 * Reads today's static catalog (lib/partners.ts, still the live source of
 * truth — this script does not change that) and generates SQL upsert
 * files for the new public.partners / public.catalog_products tables
 * (migration 0008_add_catalog_products.sql). Purely additive: nothing in
 * the app reads from these tables yet, so running this (or not) has zero
 * effect on the running site.
 *
 * Same "write SQL to scratch/, apply manually" pattern as the existing
 * (partial, 2-partner) scripts/sync-products-to-supabase.ts — no Supabase
 * credentials are read or required by this script. Apply the generated
 * files via the Supabase SQL editor / MCP once migration 0008 has been
 * applied.
 *
 * Run with: npx tsx scripts/backfill-catalog-products.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { PARTNERS } from "../lib/partners";

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

function sqlString(value: string | undefined | null): string {
  return value === undefined || value === null ? "null" : `'${sqlEscape(value)}'`;
}

function sqlNumber(value: number | undefined | null): string {
  return value === undefined || value === null ? "null" : String(value);
}

function sqlTextArray(values: string[]): string {
  if (values.length === 0) return "'{}'";
  const escaped = values.map((v) => `"${sqlEscape(v).replace(/"/g, '\\"')}"`).join(",");
  return `'{${escaped}}'`;
}

mkdirSync("scratch", { recursive: true });

// public.partners — one row per partner, id/name/tagline/href match
// lib/partners.ts's Partner type exactly (minus `products`, which is
// expressed via catalog_products.partner_id instead of a nested array).
// display_order is the PARTNERS array index (1-based). partners.display_order
// is NOT NULL with no default (migration 0009), so it must be written
// explicitly — a fresh insert into an empty table fails without it. The
// static array stays the source of order until it is deleted, at which point
// the column already is. Conflict target is `id` (the primary key), not
// display_order: 0009's unique constraint is DEFERRABLE and therefore cannot
// serve as an ON CONFLICT arbiter.
const partnerRows = PARTNERS.map(
  (p, i) =>
    `(${sqlString(p.id)}, ${sqlString(p.name)}, ${sqlString(p.tagline)}, ${sqlString(p.href)}, ${sqlString(p.logo ?? null)}, ${i + 1})`
).join(",\n");

const partnersSql = `insert into public.partners (id, name, tagline, href, logo_url, display_order)
values
${partnerRows}
on conflict (id) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  href = excluded.href,
  logo_url = excluded.logo_url,
  display_order = excluded.display_order;
`;

writeFileSync("scratch/backfill-partners.sql", partnersSql, "utf-8");
console.log(`Wrote ${PARTNERS.length} partners to scratch/backfill-partners.sql`);

// public.catalog_products — one row per RealProduct, chunked per partner
// to keep individual SQL files reviewable and within any statement-size
// limits the Supabase SQL editor imposes. search_vector is a generated
// column (migration 0008) — never written directly here.
const CHUNK_SIZE = 80;

for (const partner of PARTNERS) {
  for (let i = 0; i < partner.products.length; i += CHUNK_SIZE) {
    const chunk = partner.products.slice(i, i + CHUNK_SIZE);

    const values = chunk
      // sort_order is the product's 1-based index in its partner's static
      // array — `i` is the chunk offset, so it stays correct across chunks.
      // catalog_products.sort_order is NOT NULL with no default (migration
      // 0010), so it must be written explicitly: a fresh insert into an empty
      // table fails without it, while the on-conflict path would mask that.
      .map((p, idx) => {
        return `(
  ${sqlString(p.id)},
  ${sqlString(p.partnerId)},
  ${sqlString(p.slug)},
  ${sqlString(p.name)},
  ${sqlString(p.description)},
  ${sqlNumber(p.price)},
  ${sqlNumber(p.originalPrice ?? null)},
  ${sqlString(p.image)},
  ${sqlTextArray(p.images)},
  ${sqlString(p.category)},
  ${sqlString(p.parentCategory)},
  ${sqlString(p.badge ?? null)},
  ${sqlNumber(p.rating?.stars ?? null)},
  ${sqlNumber(p.rating?.count ?? null)},
  ${sqlString(p.deepLink)},
  ${sqlString(p.variantLabel ?? null)},
  ${i + idx + 1}
)`;
      })
      .join(",\n");

    const sql = `insert into public.catalog_products (
  id, partner_id, slug, name, description, price, original_price,
  image, images, category, parent_category, badge,
  rating_stars, rating_count, deep_link, variant_label, sort_order
)
values
${values}
on conflict (id) do update set
  partner_id = excluded.partner_id,
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  original_price = excluded.original_price,
  image = excluded.image,
  images = excluded.images,
  category = excluded.category,
  parent_category = excluded.parent_category,
  badge = excluded.badge,
  rating_stars = excluded.rating_stars,
  rating_count = excluded.rating_count,
  deep_link = excluded.deep_link,
  variant_label = excluded.variant_label,
  sort_order = excluded.sort_order,
  updated_at = now();
`;

    const part = Math.floor(i / CHUNK_SIZE) + 1;
    const path = `scratch/backfill-catalog-products-${partner.id}-p${part}.sql`;
    writeFileSync(path, sql, "utf-8");
    console.log(`Wrote ${chunk.length} products to ${path}`);
  }
}

const total = PARTNERS.reduce((sum, p) => sum + p.products.length, 0);
console.log(`\nDone. ${PARTNERS.length} partners, ${total} products total.`);
console.log(
  "Apply scratch/backfill-partners.sql first (catalog_products.partner_id references it), then the catalog-products files in any order."
);
