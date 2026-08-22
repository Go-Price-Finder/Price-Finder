#!/usr/bin/env node
/**
 * STAMP / LAST-POINT AGREEMENT, across the FULL catalog (findings §60).
 *
 * Operator ship condition 3. The as-of stamp and the chart's final point
 * must name the same date. If those two can drift they will — and then
 * one surface says a price is from the 20th while the other draws it on
 * the 21st, on the same page, beside a buy button.
 *
 * They are computed from DIFFERENT tables on purpose, which is exactly
 * why this is worth asserting:
 *   stamp      <- current_prices.feed_last_imported_at  (written 11:00Z by refreshPrices)
 *   last point <- price_history.feed_last_imported_at   (written 12:00Z by snapshotPrices)
 * Both read feed vintage, but an hour apart. If a merchant re-exports
 * between the two jobs, they disagree by a day and nothing else notices.
 *
 * FULL catalog, not a sample — the condition says so, and 1,288 products
 * is cheap.
 *
 * Runs only with credentials; SAYS SO when skipped rather than reporting
 * a pass it did not earn.
 */
import { createClient } from "@supabase/supabase-js";
import { fetchAllRows } from "../lib/supabase/fetchAllRows.ts";
import { PROVENANCE_CUTOVER_DATE } from "../lib/pricing/provenance.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SKIPPED: Supabase credentials absent — this check cannot run, and is not reporting a pass.");
  process.exit(2);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

// Last observed vintage per product, from price_history.
// Paged through the sanctioned helper rather than a hand-rolled
// .range() — the caps gate rejects the latter because a single-shot
// .range(0, 999) is indistinguishable from real paging, and this table
// is the largest in the database (19k+ rows).
const hist = new Map();
{
  const rows = await fetchAllRows((from, to) =>
    supabase
      .from("price_history")
      .select("product_id, feed_last_imported_at")
      .gte("recorded_date", PROVENANCE_CUTOVER_DATE)
      .not("feed_last_imported_at", "is", null)
      .order("product_id")
      .range(from, to)
  );
  for (const r of rows) {
    const d = r.feed_last_imported_at.slice(0, 10);
    const prev = hist.get(r.product_id);
    if (!prev || d > prev) hist.set(r.product_id, d);
  }
}

// Vintage the STAMP would name, from current_prices.
const stamp = new Map();
{
  const rows = await fetchAllRows((from, to) =>
    supabase
      .from("current_prices")
      .select("product_id, feed_last_imported_at, updated_at")
      .order("product_id")
      .range(from, to)
  );
  for (const r of rows) {
    if (r.feed_last_imported_at) stamp.set(r.product_id, r.feed_last_imported_at.slice(0, 10));
  }
}

let checked = 0, agree = 0;
const disagreements = [];
for (const [productId, lastPoint] of hist) {
  const s = stamp.get(productId);
  if (!s) continue; // catalog-priced product: its stamp comes from the
                    // hand-maintained feed vintage, not from a live row.
  checked++;
  if (s === lastPoint) agree++;
  else disagreements.push({ productId, stamp: s, lastPoint });
}

console.log(`products with an observed vintage in price_history: ${hist.size}`);
console.log(`of those, also carrying a live stamp vintage:        ${checked}`);
console.log(`stamp date == last plotted point date:               ${agree}/${checked}`);

if (checked === 0) {
  console.error("\nFAIL: zero products were actually compared — that is not a clean result, it is a vacuous one (§19).");
  process.exit(2);
}
if (disagreements.length) {
  console.error(`\nFAIL — ${disagreements.length} product(s) where the stamp and the chart would disagree:`);
  for (const d of disagreements.slice(0, 10)) {
    console.error(`  ${d.productId}\n    stamp says ${d.stamp}, last plotted point is ${d.lastPoint}`);
  }
  if (disagreements.length > 10) console.error(`  …and ${disagreements.length - 10} more`);
  process.exit(1);
}
console.log("\nPASS — every compared product's stamp names the same date as its last plotted point.");
