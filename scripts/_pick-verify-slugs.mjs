import { createClient } from "@supabase/supabase-js";
import { fetchAllRows } from "../lib/supabase/fetchAllRows.ts";
import { FRESHNESS_LIMIT_MS } from "../lib/pricing/freshness.ts";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const NOW = Date.now();
const prods = await fetchAllRows((f,t)=>s.from("catalog_products").select("id, partner_id, slug").order("id").range(f,t));
const cp = new Map();
for (const r of await fetchAllRows((f,t)=>s.from("current_prices").select("product_id, updated_at, feed_last_imported_at").order("product_id").range(f,t))) cp.set(r.product_id, r);
const out = {};
for (const p of prods) {
  const o = cp.get(p.id);
  const stamped = !!(o && NOW - Date.parse(o.updated_at) <= FRESHNESS_LIMIT_MS && o.feed_last_imported_at);
  const b = (out[p.partner_id] ??= { stamped: [], bare: [] });
  (stamped ? b.stamped : b.bare).push(p.slug);
}
console.log("partner            EXPECT-STAMP (control)                    EXPECT-NO-STAMP");
for (const [k, v] of Object.entries(out).sort()) {
  console.log(k.padEnd(18), (v.stamped[0] ?? "(none)").slice(0,42).padEnd(43), (v.bare[0] ?? "(none)").slice(0,42));
}
console.log("\ncounts:");
for (const [k, v] of Object.entries(out).sort()) console.log(`  ${k.padEnd(16)} stamped ${String(v.stamped.length).padStart(4)}   bare ${String(v.bare.length).padStart(4)}`);
