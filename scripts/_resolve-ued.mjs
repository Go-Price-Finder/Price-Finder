#!/usr/bin/env node
/** Resolve deep links whose destination is carried IN the URL (`cread.php?…&ued=`).
 * No feed lookup and no request to AWIN at all — the destination is decoded
 * locally, so this cannot self-click (handover rule 15). */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { fetchAllRows } from "../lib/supabase/fetchAllRows.ts";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const all = await fetchAllRows((f, t) => s.from("catalog_products").select("partner_id, slug, price, deep_link").order("id").range(f, t));
const out = {};
for (const p of all) {
  let dest = null, kind = "unparseable";
  try {
    const u = new URL(p.deep_link);
    if (u.searchParams.get("ued")) { dest = u.searchParams.get("ued"); kind = "ued"; }
    else if (u.pathname.includes("pclick")) { kind = "pclick(needs feed)"; }
    else if (!u.host.includes("awin")) { dest = p.deep_link; kind = "direct"; }
  } catch { /* unparseable */ }
  (out[p.partner_id] ??= []).push({ slug: p.slug, ourPrice: p.price, dest, kind });
}
for (const [partner, rows] of Object.entries(out).sort()) {
  const k = rows.reduce((a, r) => { a[r.kind] = (a[r.kind] ?? 0) + 1; return a; }, {});
  console.log(`${partner.padEnd(15)} ${String(rows.length).padStart(5)}  ${JSON.stringify(k)}`);
  const withDest = rows.filter((r) => r.dest);
  if (withDest.length) {
    const origins = new Map();
    for (const r of withDest) { let o = "?"; try { o = new URL(r.dest).origin; } catch {} origins.set(o, (origins.get(o) ?? 0) + 1); }
    for (const [o, n] of [...origins].sort((a, b) => b[1] - a[1])) console.log(`                  ${String(n).padStart(5)}  -> ${o}`);
    writeFileSync(`scripts/_ued-${partner}.json`, JSON.stringify(withDest, null, 2));
  }
}
