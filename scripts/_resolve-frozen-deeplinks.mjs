#!/usr/bin/env node
/**
 * DEEP-LINK RESOLUTION for the 68 frozen-cohort products (operator brief
 * 2026-08-22). Measurement only; underscore-prefixed, not a gate.
 *
 * THE QUESTION: does each outbound link land on a specific product page,
 * or on a category page, a homepage, or nothing?
 *
 * WHY THIS DOES NOT FOLLOW THE LINKS. Our deep_links are AWIN
 * `pclick.php?p=<id>&a=<affiliate>&m=<merchant>`. The destination is not
 * encoded in the URL — AWIN resolves `p` server-side against the same
 * product feed we hold, and the redirect request itself registers a
 * click on our own affiliate account. Following 68 of them is 68
 * self-clicks, which is a standing prohibition. So the destination is
 * reconstructed from AWIN's own source of truth for that redirect: the
 * `merchant_deep_link` column of the feed keyed by `aw_product_id`.
 *
 * That reconstruction is not a weaker check. It is strictly stronger on
 * the failure that matters most: a `p` id ABSENT from the feed means
 * AWIN has no destination to resolve at all, which a redirect-follow
 * would show only as a silent bounce to the merchant homepage.
 *
 * Stage 1 (this file) resolves ids to URLs. Stage 2 checks the URLs from
 * the merchant's own origin — see the report; text extraction is a
 * hypothesis, never a finding (ledger §66).
 */
import { readFileSync, writeFileSync } from "node:fs";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";
import { fetchAllRows } from "../lib/supabase/fetchAllRows.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("SKIPPED: credentials absent."); process.exit(2); }
const supabase = createClient(url, key, { auth: { persistSession: false } });

const FEEDS = {
  "canvas-vows": "scripts/_canvas-vows-feed.csv",
  "tsar-bomba": "scripts/_tsarbomba-default-feed.csv",
};

// The 26 tsar-bomba products on the frozen Default feed. Imported rather
// than re-listed: a second copy of this split is a second thing to keep
// in step (the same reason getSourceFeedStatusId reuses getSourceFeed).
const { TSAR_BOMBA_DEFAULT_FEED_SLUGS } = await import("./_tsarbomba-default-slugs.mjs");

const feedIndex = {};
for (const [partner, path] of Object.entries(FEEDS)) {
  const rows = Papa.parse(readFileSync(path, "utf8"), { header: true, skipEmptyLines: true }).data;
  const byId = new Map();
  for (const r of rows) if (r.aw_product_id) byId.set(String(r.aw_product_id).trim(), r);
  feedIndex[partner] = byId;
  console.log(`feed ${path}: ${byId.size} products indexed by aw_product_id`);
}

const products = await fetchAllRows((from, to) =>
  supabase.from("catalog_products")
    .select("id, partner_id, slug, name, price, deep_link")
    .in("partner_id", ["canvas-vows", "tsar-bomba"])
    .order("id").range(from, to));

const cohort = products.filter((p) =>
  p.partner_id === "canvas-vows" || TSAR_BOMBA_DEFAULT_FEED_SLUGS.has(p.slug));

console.log(`\ncohort: ${cohort.length} products ` +
  `(canvas-vows ${cohort.filter(c => c.partner_id === "canvas-vows").length}, ` +
  `tsar-bomba Default ${cohort.filter(c => c.partner_id === "tsar-bomba").length})`);

const out = [];
const unmatched = [];
for (const p of cohort) {
  let pid = null;
  try { pid = new URL(p.deep_link).searchParams.get("p"); } catch { /* recorded below */ }
  const row = pid ? feedIndex[p.partner_id].get(pid) : null;
  if (!row) { unmatched.push({ ...p, pid }); continue; }
  out.push({
    partner: p.partner_id, slug: p.slug, pid,
    ourPrice: p.price,
    feedPrice: row.search_price ?? row.store_price ?? null,
    dest: (row.merchant_deep_link || "").trim(),
    feedName: (row.product_name || "").trim(),
  });
}

console.log(`\nresolved to a merchant URL: ${out.length}`);
console.log(`p= id NOT PRESENT in the feed: ${unmatched.length}`);
for (const u of unmatched) console.log(`   ${u.partner}/${u.slug}  p=${u.pid}`);

const noDest = out.filter((o) => !o.dest);
if (noDest.length) {
  console.log(`\nin the feed but with an EMPTY merchant_deep_link: ${noDest.length}`);
  for (const o of noDest) console.log(`   ${o.partner}/${o.slug}`);
}

const byOrigin = new Map();
for (const o of out.filter((x) => x.dest)) {
  let origin = "(unparseable)";
  try { origin = new URL(o.dest).origin; } catch { /* counted as unparseable */ }
  byOrigin.set(origin, (byOrigin.get(origin) ?? 0) + 1);
}
console.log("\ndestination origins:");
for (const [o, n] of [...byOrigin].sort()) console.log(`  ${String(n).padStart(4)}  ${o}`);

const distinct = new Set(out.map((o) => o.dest).filter(Boolean));
console.log(`\ndistinct destination URLs: ${distinct.size} (from ${out.length} products)`);

writeFileSync("scripts/_deeplink-targets.json", JSON.stringify({ resolved: out, unmatched }, null, 2));
console.log("wrote scripts/_deeplink-targets.json");
