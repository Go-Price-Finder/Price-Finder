import { createClient } from "@supabase/supabase-js";
import { fetchAllRows } from "../lib/supabase/fetchAllRows.ts";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const all = await fetchAllRows((f,t)=>s.from("catalog_products").select("partner_id, deep_link").order("id").range(f,t));
const m = new Map();
for (const p of all) {
  let shape = "(unparseable)";
  try { const u = new URL(p.deep_link); shape = u.host + u.pathname.replace(/\/[^/]*$/, "/…"); } catch {}
  const k = p.partner_id + "  ->  " + shape;
  m.set(k, (m.get(k) ?? 0) + 1);
}
console.log("catalog total:", all.length);
for (const [k,v] of [...m].sort()) console.log(String(v).padStart(6), k);
