#!/usr/bin/env node
/**
 * ONE-OFF INVESTIGATION (operator brief 2026-08-20): for the two
 * partners whose products share a displayed title, WHICH COLUMN IN THE
 * FEED actually tells the rows apart?
 *
 * king-koil: 29 catalog products, ONE title, and (operator-verified) the
 * same description and category too — only price and a numeric slug
 * suffix differ. canvas-vows: 42 titles across 204 products.
 *
 * If a differentiating column exists, enrichment at import is bounded
 * work. If none exists, we are importing rows we cannot tell apart, and
 * the options are the operator's, not ours.
 *
 * METHOD: for each title-group, walk EVERY column in the feed and report
 * the ones whose values are not constant across the group. Report the
 * actual values, not a count — a column with 29 distinct values that are
 * all empty strings, or all the same URL with a tracking id, is not a
 * differentiator, and only the values show that.
 *
 * Run: node --env-file=.env.local scripts/_audit-differentiators.mjs
 */
import { gunzipSync } from "node:zlib";
import Papa from "papaparse";

const FEED_LIST_URL = process.env.AWIN_FEED_LIST_URL;
if (!FEED_LIST_URL) {
  console.error("Missing AWIN_FEED_LIST_URL — run with --env-file=.env.local");
  process.exit(1);
}

const TARGETS = [
  { partner: "king-koil", feed: "101819", nameCol: "product_name" },
  { partner: "canvas-vows", feed: "103552", nameCol: "product_name" },
];

const list = Papa.parse(await (await fetch(FEED_LIST_URL)).text(), { header: true, skipEmptyLines: true }).data;
const byId = new Map(list.map((r) => [String(r["Feed ID"]), r]));

async function dl(id) {
  const res = await fetch(byId.get(id).URL);
  const b = Buffer.from(await res.arrayBuffer());
  let t;
  try { t = gunzipSync(b).toString("utf8"); } catch { t = b.toString("utf8"); }
  return Papa.parse(t, { header: true, skipEmptyLines: true });
}

const trunc = (s, n) => (s.length > n ? s.slice(0, n) + "…" : s);

for (const t of TARGETS) {
  const parsed = await dl(t.feed);
  const rows = parsed.data;
  const headers = (parsed.meta.fields || []).map((h) => h.trim());

  console.log("=".repeat(78));
  console.log(`${t.partner} — feed ${t.feed} — ${rows.length} rows, ${headers.length} columns`);
  console.log("=".repeat(78));

  // Group by title.
  const groups = new Map();
  for (const r of rows) {
    const k = String(r[t.nameCol] ?? "").trim();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const multi = [...groups.entries()].filter(([, g]) => g.length > 1).sort((a, b) => b[1].length - a[1].length);
  console.log(`title groups with >1 row: ${multi.length}; largest: ${multi[0] ? multi[0][1].length : 0}\n`);

  // Take the largest group and find every column that varies within it.
  const [title, group] = multi[0];
  console.log(`LARGEST GROUP: ${group.length} rows, title "${trunc(title, 60)}"\n`);

  const varying = [];
  const constant = [];
  for (const h of headers) {
    const vals = group.map((r) => String(r[h] ?? "").trim());
    const distinct = [...new Set(vals)];
    const allEmpty = distinct.length === 1 && distinct[0] === "";
    if (allEmpty) continue;
    if (distinct.length === 1) constant.push(h);
    else varying.push({ column: h, distinct: distinct.length, values: distinct });
  }

  console.log(`COLUMNS THAT VARY WITHIN THE GROUP (${varying.length}):`);
  for (const v of varying) {
    const sample = v.values.slice(0, 8).map((x) => (x === "" ? "(empty)" : trunc(x, 62)));
    console.log(`  ${v.column}  [${v.distinct} distinct]`);
    for (const s of sample) console.log(`      ${s}`);
    if (v.values.length > 8) console.log(`      …and ${v.values.length - 8} more`);
  }
  console.log(`\nCOLUMNS CONSTANT ACROSS ALL ${group.length} ROWS (${constant.length}): ${constant.join(", ")}\n`);

  // Across ALL multi-row groups: which columns vary in every group?
  const variesEverywhere = new Map();
  for (const [, g] of multi) {
    for (const h of headers) {
      const vals = g.map((r) => String(r[h] ?? "").trim());
      if (new Set(vals).size > 1) variesEverywhere.set(h, (variesEverywhere.get(h) ?? 0) + 1);
    }
  }
  console.log(`ACROSS ALL ${multi.length} MULTI-ROW GROUPS — how many groups each column differentiates:`);
  for (const [h, n] of [...variesEverywhere.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}/${multi.length}  ${h}`);
  }
  console.log();
}
