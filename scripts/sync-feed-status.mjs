#!/usr/bin/env node
/**
 * FEED-STATUS SYNC — the link that never existed (findings §53).
 *
 * `feed_status.feed_last_imported_at` is the value that separates "the
 * merchant repriced" from "the feed refreshed". It has been NULL for
 * exactly the four CURRENT feeds — evdance F1320, golden-maple F2615,
 * king-koil 101819, tsar-bomba 113495 — which is to say NULL for every
 * feed that could plausibly move. The value has been sitting in AWIN's
 * own feed list the whole time; nothing read it into the table.
 *
 * This job reads it and writes it. `snapshotPrices` then stamps each
 * price_history row with the vintage of the feed that produced it, so
 * that a future movement claim can be filtered to observations where
 * the feed did NOT refresh.
 *
 * WHAT THIS CANNOT DO, stated because the temptation is obvious:
 * it cannot repair the past. feed_status is CURRENT-STATE — one row per
 * feed, no temporal dimension — so nothing anywhere records what
 * `feed_last_imported_at` was on any past day. Stamping the 18,154
 * existing price_history rows from today's value would fabricate a
 * measurement. Those rows stay permanently ambiguous on feed vintage,
 * and that is a property of the data, not a regret.
 *
 * Usage:
 *   node --env-file=.env.local scripts/sync-feed-status.mjs [--dry-run]
 *
 * Intended as a scheduled job running BEFORE the daily snapshot, so the
 * vintage stamped on a row is the vintage that produced its price.
 */
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";

const DRY = process.argv.includes("--dry-run");

const FEED_LIST_URL = process.env.AWIN_FEED_LIST_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
for (const [name, v] of Object.entries({ AWIN_FEED_LIST_URL: FEED_LIST_URL, NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })) {
  if (!v) { console.error(`Missing ${name} — run with --env-file=.env.local`); process.exit(1); }
}

/** AWIN publishes these as local-ish strings; parse defensively and
 * refuse anything we cannot turn into a real instant rather than
 * writing a plausible-looking wrong timestamp. */
function parseStamp(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const iso = s.includes("T") ? s : s.replace(" ", "T") + (/[+Z]/.test(s) ? "" : "Z");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const res = await fetch(FEED_LIST_URL);
if (!res.ok) { console.error(`Feed list fetch failed: HTTP ${res.status}`); process.exit(2); }
const feedRows = Papa.parse(await res.text(), { header: true, skipEmptyLines: true }).data;
if (feedRows.length < 50) {
  console.error(`FAIL: feed list returned only ${feedRows.length} rows — that is not the AWIN list, and writing from it would corrupt feed_status.`);
  process.exit(2);
}
const byFeedId = new Map(feedRows.map((r) => [String(r["Feed ID"]).trim(), r]));

const { data: statusRows, error: readErr } = await supabase
  .from("feed_status")
  .select("feed_id, partner_id, feed_last_imported_at, feed_last_checked_at");
if (readErr) { console.error("FAIL reading feed_status:", readErr.message); process.exit(2); }

const readAt = new Date().toISOString();
const updates = [];
const skipped = [];

for (const row of statusRows) {
  const src = byFeedId.get(String(row.feed_id).trim());
  if (!src) {
    // Sentinel rows (e.g. none:brooklyn-delhi) legitimately have no feed.
    skipped.push({ feed_id: row.feed_id, partner_id: row.partner_id, why: "not present in the AWIN feed list" });
    continue;
  }
  const imported = parseStamp(src["Last Imported"]);
  const checked = parseStamp(src["Last Checked"]);
  if (!imported && !checked) {
    skipped.push({ feed_id: row.feed_id, partner_id: row.partner_id, why: "feed list carries no usable timestamp" });
    continue;
  }
  updates.push({
    feed_id: row.feed_id,
    was: row.feed_last_imported_at,
    now: imported,
    checked,
    partner_id: row.partner_id,
  });
}

console.log(`AWIN feed list: ${feedRows.length} feeds. feed_status rows: ${statusRows.length}.`);
console.log(`Updating: ${updates.length}   Skipped: ${skipped.length}`);
for (const u of updates) {
  const changed = u.was !== u.now;
  console.log(`  ${String(u.partner_id).padEnd(15)} ${String(u.feed_id).padEnd(9)} ${String(u.was ?? "NULL").padEnd(26)} -> ${u.now}${changed ? "" : "   (unchanged)"}`);
}
for (const s of skipped) console.log(`  SKIP ${String(s.partner_id).padEnd(15)} ${String(s.feed_id).padEnd(9)} ${s.why}`);

if (DRY) { console.log("\n(dry run — nothing written)"); process.exit(0); }

let written = 0;
for (const u of updates) {
  const { error } = await supabase
    .from("feed_status")
    .update({
      feed_last_imported_at: u.now,
      feed_last_checked_at: u.checked,
      feed_status_read_at: readAt,
    })
    .eq("feed_id", u.feed_id);
  if (error) { console.error(`  FAIL ${u.feed_id}: ${error.message}`); continue; }
  written++;
}
console.log(`\nWrote ${written} of ${updates.length} feed_status rows.`);
process.exit(written === updates.length ? 0 : 1);
