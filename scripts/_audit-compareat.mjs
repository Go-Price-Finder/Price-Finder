#!/usr/bin/env node
/**
 * ONE-OFF INVESTIGATION (operator brief 2026-08-20): does each partner's
 * LIVE feed carry a compare-at / list price column at all, is it
 * populated, and does scripts/import-partner.mjs map it?
 *
 * Answers the question that "original_price is NULL on 1,452 of 1,453
 * rows" cannot: whether that is a merchant fact or an importer fact.
 *
 * FEED IDS ARE EXPLICIT, and that is the point. A first pass let a
 * heuristic ("English, no vertical") choose, and it silently picked an
 * 8-row feed for a 500-product partner and a 1-row feed for a 72-product
 * one. Each id below is pinned by matching the AWIN feed list's product
 * count against the imported catalog count.
 *
 * Run: node --env-file=.env.local scripts/_audit-compareat.mjs
 */
import { gunzipSync } from "node:zlib";
import Papa from "papaparse";

const FEED_LIST_URL = process.env.AWIN_FEED_LIST_URL;
if (!FEED_LIST_URL) {
  console.error("Missing AWIN_FEED_LIST_URL — run with --env-file=.env.local");
  process.exit(1);
}

// partnerId -> { feedIds, catalogCount } . catalogCount is the number of
// products actually in lib/<partner>-data.ts, used as the control: if a
// feed's row count is nowhere near it, the wrong feed is being read.
const PARTNERS = {
  aaawave: { feeds: ["F2639"], catalog: 500 },
  "canvas-vows": { feeds: ["103552"], catalog: 204 },
  evdance: { feeds: ["F1320"], catalog: 72 },
  "golden-maple": { feeds: ["F2615"], catalog: 348 },
  "king-koil": { feeds: ["101819"], catalog: 29 },
  // Imported as a Default + US merge (2026-07-29), hence two feeds.
  "tsar-bomba": { feeds: ["105368", "113495"], catalog: 271 },
  // brooklyn-delhi has NO row in the AWIN feed list at all — see report.
  "brooklyn-delhi": { feeds: [], catalog: 29 },
};

// What import-partner.mjs actually looks for.
const MAPPED = ["rrp_price", "rrp", "list_price", "original_price", "was_price"];
// What it does NOT look for, including the two the operator named.
const UNMAPPED = [
  "display_price", "store_price", "sale_price", "base_price", "msrp",
  "regular_price", "price_was", "saving", "discount", "product_price_old",
  "old_price", "retail_price", "compare_at_price", "compare_at",
];
const PRICE_CANDIDATES = ["search_price", "sale_price", "price", "current_price"];

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const listRes = await fetch(FEED_LIST_URL);
const feedList = Papa.parse(await listRes.text(), { header: true, skipEmptyLines: true }).data;
const byId = new Map(feedList.map((r) => [String(r["Feed ID"]), r]));

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  try { return gunzipSync(buf).toString("utf8"); } catch { return buf.toString("utf8"); }
}

function inspect(cands, headers, lower, data, priceCol) {
  const out = [];
  for (const c of cands) {
    const idx = lower.indexOf(c);
    if (idx === -1) continue;
    const col = headers[idx];
    let populated = 0, higher = 0, equal = 0, lowerThan = 0;
    for (const r of data) {
      const v = num(r[col]);
      if (v == null) continue;
      populated++;
      const p = priceCol ? num(r[priceCol]) : null;
      if (p == null) continue;
      if (v > p) higher++;
      else if (v === p) equal++;
      else lowerThan++;
    }
    out.push({ column: col, populated, higherThanPrice: higher, equalToPrice: equal, lowerThanPrice: lowerThan });
  }
  return out;
}

const report = [];
for (const [partnerId, cfg] of Object.entries(PARTNERS)) {
  if (cfg.feeds.length === 0) {
    report.push({ partnerId, catalog: cfg.catalog, feeds: [], note: "no row in the AWIN feed list for this advertiser" });
    continue;
  }
  const feeds = [];
  for (const id of cfg.feeds) {
    const meta = byId.get(id);
    if (!meta) { feeds.push({ feedId: id, error: "feed id not in feed list" }); continue; }
    let csv;
    try { csv = await download(meta.URL); }
    catch (e) { feeds.push({ feedId: id, error: `download failed: ${e.message}` }); continue; }
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    const data = parsed.data;
    const headers = (parsed.meta.fields || []).map((h) => h.trim());
    const lower = headers.map((h) => h.toLowerCase());
    const priceCol = PRICE_CANDIDATES
      .map((c) => headers[lower.indexOf(c)])
      .find((c) => c && data.some((r) => String(r[c] ?? "").trim() !== ""));
    feeds.push({
      feedId: id,
      feedName: meta["Feed Name"] || "Default",
      declaredProducts: meta["No of products"],
      rowsDownloaded: data.length,
      priceColumnUsed: priceCol ?? null,
      mappedCandidatesPresent: inspect(MAPPED, headers, lower, data, priceCol),
      unmappedCandidatesPresent: inspect(UNMAPPED, headers, lower, data, priceCol),
      priceLikeHeaders: headers.filter((h) => /price|rrp|msrp|cost|saving|discount/i.test(h)),
      headerCount: headers.length,
    });
  }
  const totalRows = feeds.reduce((a, f) => a + (f.rowsDownloaded || 0), 0);
  report.push({
    partnerId,
    catalog: cfg.catalog,
    totalRows,
    rowCountControl: totalRows >= cfg.catalog ? "plausible" : "SUSPECT — fewer feed rows than catalog products",
    feeds,
  });
}

console.log(JSON.stringify(report, null, 2));
