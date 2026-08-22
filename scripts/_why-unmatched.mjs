import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";
import { fetchAllRows } from "../lib/supabase/fetchAllRows.ts";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const live = Papa.parse(readFileSync("scripts/_feed-113495.csv", "utf8"), { header: true, skipEmptyLines: true }).data;
const liveIds = new Set(live.map(r => String(r.aw_product_id || "").trim()).filter(Boolean));
const cached = Papa.parse(readFileSync("scripts/_tsarbomba-us-feed.csv", "utf8"), { header: true, skipEmptyLines: true }).data;
const cachedIds = new Set(cached.map(r => String(r.aw_product_id || "").trim()).filter(Boolean));
console.log(`feed 113495 TODAY: ${liveIds.size} ids   |  cached (2026-08-02 era): ${cachedIds.size} ids`);
console.log(`  ids in cached but GONE from today's feed: ${[...cachedIds].filter(i => !liveIds.has(i)).length}`);

const prods = await fetchAllRows((f,t)=>s.from("catalog_products").select("id, slug, deep_link").eq("partner_id","tsar-bomba").order("id").range(f,t));
const cps = new Set((await fetchAllRows((f,t)=>s.from("current_prices").select("product_id").order("product_id").range(f,t))).map(r=>r.product_id));
let liveMatch=0, inFeedNoRow=0, notInFeed=0, noPid=0;
const notInFeedSlugs=[];
for (const p of prods) {
  const m = (p.deep_link||"").match(/[?&]p=(\d+)/);
  if (!m) { noPid++; continue; }
  const inFeed = liveIds.has(m[1]);
  const hasRow = cps.has(p.id);
  if (hasRow) liveMatch++;
  else if (inFeed) inFeedNoRow++;
  else { notInFeed++; if(notInFeedSlugs.length<5) notInFeedSlugs.push(p.slug); }
}
console.log(`\ntsar-bomba ${prods.length} products:`);
console.log(`  has a current_prices row                      : ${liveMatch}`);
console.log(`  p= IS in today's 113495 but NO row was written : ${inFeedNoRow}   <-- refresh reached the feed and skipped them`);
console.log(`  p= not in today's 113495 (Default-feed or dropped): ${notInFeed}`);
console.log(`  deep_link has no p= at all                    : ${noPid}`);
if (notInFeedSlugs.length) console.log("  examples not in feed:", notInFeedSlugs.join(", "));
