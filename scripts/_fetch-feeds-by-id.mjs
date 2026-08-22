#!/usr/bin/env node
/** Fetch specific AWIN feeds by Feed ID, save raw CSV. Read-only against
 * AWIN's feed-list endpoint — this is feed metadata, NOT a tracking link. */
import { gunzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import Papa from "papaparse";
const want = new Set(process.argv.slice(2));
const res = await fetch(process.env.AWIN_FEED_LIST_URL);
if (!res.ok) { console.error("feed list HTTP " + res.status); process.exit(1); }
const list = Papa.parse(await res.text(), { header: true, skipEmptyLines: true }).data;
for (const r of list) {
  const id = String(r["Feed ID"] || "").trim();
  if (!want.has(id)) continue;
  console.log(`feed ${id} "${r["Advertiser Name"]}" / "${r["Feed Name"] || "Default"}" lastImported=${r["Last Imported"]} rows=${r["No of products"]}`);
  const fr = await fetch(r["URL"]);
  if (!fr.ok) { console.error(`  download HTTP ${fr.status}`); continue; }
  const buf = Buffer.from(await fr.arrayBuffer());
  let text; try { text = gunzipSync(buf).toString("utf8"); } catch { text = buf.toString("utf8"); }
  writeFileSync(`scripts/_feed-${id}.csv`, text);
  console.log(`  wrote scripts/_feed-${id}.csv (${text.length} bytes)`);
}
