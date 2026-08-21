#!/usr/bin/env node
/**
 * ONE-OFF INVESTIGATION (operator brief 2026-08-20): do our feeds model
 * variants, how many feed rows are one variant among several, and how
 * many of OUR imported products sit inside a multi-variant group?
 *
 * We do not model variants at all — one catalog row, one price, under a
 * title that may cover several purchasable options. On a gift box that
 * is confusing-but-true. On a drive listed at one price under a title
 * spanning 4TB/8TB/12TB it is materially misleading.
 *
 * THIS SCRIPT'S FIRST VERSION WAS WRONG AND THE WAY IT WAS WRONG IS THE
 * POINT. It auto-picked "the column with the most rows in multi-row
 * groups" as the variant-grouping column. That rule selects precisely
 * the most useless column: it chose canvas-vows' `model_number`, whose
 * value is the literal string "personalized canvas" on all 204 rows, and
 * tsar-bomba's, whose value is "7.17701e+11" — a number the feed mangled
 * into scientific notation — grouping 18 unrelated watches. It would
 * have reported "204 of 204 canvas-vows products are variants with a
 * 786% price spread". So this version does NOT auto-pick. It CLASSIFIES
 * every candidate column by the shape of its groups and reports the
 * evidence.
 *
 * It also measures the signal that does not depend on the merchant
 * populating a grouping column at all: IDENTICAL PRODUCT TITLES. The
 * operator's concern is literally about the title — "one catalog row
 * carries one price under a title that may cover several purchasable
 * options" — so rows sharing a title, priced differently, are the
 * observable fingerprint whether or not an item_group_id exists.
 *
 * Run: node --env-file=.env.local scripts/_audit-variants.mjs
 */
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import Papa from "papaparse";

const FEED_LIST_URL = process.env.AWIN_FEED_LIST_URL;
if (!FEED_LIST_URL) {
  console.error("Missing AWIN_FEED_LIST_URL — run with --env-file=.env.local");
  process.exit(1);
}

const PARTNERS = {
  aaawave: { feeds: ["F2639"], catalog: 500, data: "lib/aaawave-data.ts" },
  "canvas-vows": { feeds: ["103552"], catalog: 204, data: "lib/canvas-vows-data.ts" },
  evdance: { feeds: ["F1320"], catalog: 72, data: "lib/evdance-data.ts" },
  "golden-maple": { feeds: ["F2615"], catalog: 348, data: "lib/golden-maple-data.ts" },
  "king-koil": { feeds: ["101819"], catalog: 29, data: "lib/king-koil-data.ts" },
  "tsar-bomba": { feeds: ["105368", "113495"], catalog: 271, data: "lib/tsar-bomba-data.ts" },
  "brooklyn-delhi": { feeds: [], catalog: 29, data: "lib/brooklyn-delhi-data.ts" },
};

const GROUP_CANDIDATES = [
  "item_group_id", "parent_product_id", "product_group_id", "group_id",
  "parent_sku", "parent_id", "mpn", "model_number",
];
const AXIS_CANDIDATES = [
  "colour", "color", "size", "capacity", "material", "style", "pattern",
  "custom_1", "custom_2", "custom_3", "custom_4", "custom_5",
  "variant", "variant_title", "option", "flavour", "flavor",
];
const PRICE_CANDIDATES = ["search_price", "sale_price", "price", "current_price"];
const NAME_CANDIDATES = ["product_name", "name", "title", "product name"];
const LINK_CANDIDATES = ["aw_deep_link", "deep_link", "merchant_deep_link", "link", "product_url", "url"];
const AWID_CANDIDATES = ["aw_product_id", "merchant_product_id", "id"];

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const norm = (s) => String(s ?? "").trim().toLowerCase();

const listRes = await fetch(FEED_LIST_URL);
const feedList = Papa.parse(await listRes.text(), { header: true, skipEmptyLines: true }).data;
const byId = new Map(feedList.map((r) => [String(r["Feed ID"]), r]));

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  try { return gunzipSync(buf).toString("utf8"); } catch { return buf.toString("utf8"); }
}

/** slug/name/deepLink per product from a generated partner data file.
 * Tolerates comment lines between fields — one tsar-bomba product
 * carries a §26 rename note between slug and name, which the first
 * version silently dropped (270 parsed vs 271 present). The count is
 * asserted against the known catalog size so that cannot recur quietly. */
function readImported(path) {
  const src = readFileSync(path, "utf8");
  const blocks = src.split(/\n  \{\n/).slice(1);
  const out = [];
  for (const b of blocks) {
    const slug = /^\s*slug: "((?:[^"\\]|\\.)*)",/m.exec(b);
    const name = /^\s*name: "((?:[^"\\]|\\.)*)",/m.exec(b);
    const link = /^\s*deepLink:\s*\n?\s*"((?:[^"\\]|\\.)*)",/m.exec(b);
    const price = /^\s*price: ([0-9.]+),/m.exec(b);
    if (!slug) continue;
    out.push({
      slug: slug[1],
      name: name ? name[1] : "",
      deepLink: link ? link[1] : "",
      price: price ? parseFloat(price[1]) : null,
    });
  }
  return out;
}

/** Join keys we can derive from a stored AWIN deep link. tsar-bomba uses
 * pclick.php?p=<aw_product_id>; the others wrap a merchant URL in ued=. */
function linkKeys(link) {
  const keys = [];
  const ued = /[?&]ued=([^&]+)/.exec(link || "");
  if (ued) {
    let u = ued[1];
    try { u = decodeURIComponent(u); } catch {}
    keys.push("url:" + norm(u).replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, ""));
  }
  const p = /[?&]p=([^&]+)/.exec(link || "");
  if (p) keys.push("awid:" + norm(p[1]));
  return keys;
}

function classify(populated, rows, distinct, groupSizes) {
  if (populated === 0) return "HEADER ONLY — zero populated rows";
  const maxGroup = groupSizes.length ? Math.max(...groupSizes) : 1;
  if (distinct >= populated * 0.98) return "IDENTIFIER — ~unique per row, not a grouping key";
  if (distinct <= 10 && maxGroup > 30) return "CATEGORY-LIKE — few values, huge buckets; not variants";
  if (maxGroup > 25) return "SUSPECT — group sizes too large to be variants of one product";
  return "PLAUSIBLE VARIANT GROUPING";
}

const report = [];

for (const [partnerId, cfg] of Object.entries(PARTNERS)) {
  const imported = readImported(cfg.data);
  const parseControl = imported.length === cfg.catalog
    ? `ok (${imported.length})`
    : `SUSPECT — parsed ${imported.length}, expected ${cfg.catalog}`;

  if (cfg.feeds.length === 0) {
    report.push({ partnerId, catalog: cfg.catalog, parseControl, note: "no AWIN feed exists for this advertiser (§46) — cannot measure variants from a feed" });
    continue;
  }

  // Resolve columns PER FEED — tsar-bomba merges two feeds whose headers
  // differ, and resolving globally silently blanked one feed's rows.
  const rows = [];
  const feedMeta = [];
  for (const id of cfg.feeds) {
    const meta = byId.get(id);
    if (!meta) { feedMeta.push({ feedId: id, error: "not in feed list" }); continue; }
    const parsed = Papa.parse(await download(meta.URL), { header: true, skipEmptyLines: true });
    const hs = (parsed.meta.fields || []).map((h) => h.trim());
    const lo = hs.map((h) => h.toLowerCase());
    const pick = (cands) => {
      for (const c of cands) {
        const i = lo.indexOf(c);
        if (i !== -1 && parsed.data.some((r) => String(r[hs[i]] ?? "").trim() !== "")) return hs[i];
      }
      return null;
    };
    const cols = {
      price: pick(PRICE_CANDIDATES), name: pick(NAME_CANDIDATES),
      link: pick(LINK_CANDIDATES), awid: pick(AWID_CANDIDATES),
    };
    for (const r of parsed.data) {
      rows.push({
        raw: r, headers: hs, lower: lo,
        name: cols.name ? String(r[cols.name] ?? "") : "",
        price: cols.price ? num(r[cols.price]) : null,
        keys: [
          ...(cols.link ? linkKeys(String(r[cols.link] ?? "")) : []),
          ...(cols.awid ? ["awid:" + norm(r[cols.awid])] : []),
        ],
      });
    }
    feedMeta.push({ feedId: id, rows: parsed.data.length, headerCount: hs.length, resolved: cols });
  }

  // ---- grouping columns, CLASSIFIED, never auto-picked ----
  const allHeaders = [...new Set(rows.flatMap((r) => r.headers))];
  const groupingColumns = [];
  for (const cand of GROUP_CANDIDATES) {
    const header = allHeaders.find((h) => h.toLowerCase() === cand);
    if (!header) continue;
    const vals = rows.map((r) => norm(r.raw[header])).filter((v) => v !== "");
    const counts = new Map();
    for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
    const sizes = [...counts.values()].filter((n) => n > 1);
    groupingColumns.push({
      column: header,
      populated: vals.length,
      populatedPct: rows.length ? Math.round((vals.length / rows.length) * 1000) / 10 : 0,
      distinctValues: counts.size,
      multiRowGroups: sizes.length,
      rowsInMultiRowGroups: sizes.reduce((a, n) => a + n, 0),
      largestGroup: sizes.length ? Math.max(...sizes) : 1,
      verdict: classify(vals.length, rows.length, counts.size, sizes),
    });
  }
  const axisColumns = AXIS_CANDIDATES.map((cand) => {
    const header = allHeaders.find((h) => h.toLowerCase() === cand);
    if (!header) return null;
    const vals = rows.map((r) => norm(r.raw[header])).filter((v) => v !== "");
    if (vals.length === 0) return { column: header, populated: 0, verdict: "HEADER ONLY" };
    return { column: header, populated: vals.length, distinctValues: new Set(vals).size,
      sample: [...new Set(vals)].slice(0, 5) };
  }).filter(Boolean);

  // ---- identical-title analysis: the signal that needs no group id ----
  const byTitle = new Map();
  for (const r of rows) {
    const k = norm(r.name);
    if (!k) continue;
    if (!byTitle.has(k)) byTitle.set(k, []);
    byTitle.get(k).push(r);
  }
  const titleGroups = [...byTitle.values()].filter((g) => g.length > 1);

  // ---- join OUR products to feed rows ----
  const index = new Map();
  for (const r of rows) for (const k of r.keys) if (k && !index.has(k)) index.set(k, r);
  const titleIndex = new Map();
  for (const [k, g] of byTitle) titleIndex.set(k, g);

  let byKey = 0, byName = 0, unmatched = 0;
  const hits = [];
  for (const p of imported) {
    let row = null;
    for (const k of linkKeys(p.deepLink)) if (index.has(k)) { row = index.get(k); break; }
    if (row) byKey++;
    else if (titleIndex.has(norm(p.name))) { row = titleIndex.get(norm(p.name))[0]; byName++; }
    else { unmatched++; continue; }

    const sibs = titleIndex.get(norm(row.name)) ?? [row];
    if (sibs.length > 1) {
      const prices = sibs.map((s) => s.price).filter((x) => x != null);
      const min = Math.min(...prices), max = Math.max(...prices);
      hits.push({
        slug: p.slug, ourName: p.name, ourPrice: p.price,
        feedRowsSharingThisTitle: sibs.length,
        priceMin: min, priceMax: max,
        spreadAbs: Math.round((max - min) * 100) / 100,
        spreadPct: min > 0 ? Math.round(((max - min) / min) * 1000) / 10 : null,
      });
    }
  }
  const matched = byKey + byName;
  const rate = imported.length ? Math.round((matched / imported.length) * 1000) / 10 : 0;

  report.push({
    partnerId,
    catalog: cfg.catalog,
    parseControl,
    feeds: feedMeta,
    totalFeedRows: rows.length,
    groupingColumns,
    axisColumns,
    identicalTitles: {
      titleGroupsWithMoreThanOneRow: titleGroups.length,
      feedRowsSharingATitle: titleGroups.reduce((a, g) => a + g.length, 0),
      largestTitleGroup: titleGroups.length ? Math.max(...titleGroups.map((g) => g.length)) : 0,
    },
    join: { matchedByKey: byKey, matchedByTitle: byName, unmatched, matchRatePct: rate,
      TRUSTWORTHY: rate >= 90 },
    ourProductsSharingATitleWithOtherFeedRows: hits.length,
    ourProductsWithMeaningfulSpread: hits.filter((h) => (h.spreadPct ?? 0) >= 20 || h.spreadAbs >= 50).length,
    worstSpreads: hits.sort((a, b) => b.spreadAbs - a.spreadAbs).slice(0, 6),
  });
}

console.log(JSON.stringify(report, null, 2));
