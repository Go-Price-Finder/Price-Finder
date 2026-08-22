import { createClient } from "@supabase/supabase-js";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await s.from("catalog_products").select("partner_id, slug, deep_link").in("partner_id", ["canvas-vows","tsar-bomba"]).limit(400);
const seen = new Set();
for (const d of data) {
  try {
    const u = new URL(d.deep_link);
    const shape = `${u.host}${u.pathname} ? ${[...u.searchParams.keys()].sort().join("&")}`;
    if (!seen.has(shape)) { seen.add(shape); console.log(`\nSHAPE ${shape}\n  eg ${d.partner_id}/${d.slug}\n  raw ${d.deep_link}`); }
  } catch { console.log("UNPARSEABLE", d.partner_id, d.slug, d.deep_link); }
}
