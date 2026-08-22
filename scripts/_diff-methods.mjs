#!/usr/bin/env node
/** Two methods disagreed on tsar-bomba (19 vs 6 remove) and on the Default
 * feed (25 vs 7). Rule 16 says re-derive, and then RESOLVE — not report a
 * range. This prints, per handle, exactly what each method saw. */
import { readFileSync } from "node:fs";

const pairs = JSON.parse(readFileSync(`scripts/_h-${process.argv[2]}.json`, "utf8")).pairs;
const origin = process.argv[3];

// method 2 inputs, rebuilt here so both are computed side by side
const map = new Map();
let page = 1;
while (page <= 40) {
  const r = await fetch(`${origin}/products.json?limit=250&page=${page}`);
  const j = await r.json();
  if (!(j.products || []).length) break;
  for (const p of j.products) map.set(p.handle, p.variants.map((v) => String(v.id)));
  page++;
}
console.log(`products.json handles: ${map.size}`);

const handles = [...new Set(pairs.map((p) => p[1].replace(/^\/products\//, "")))];
console.log(`our handles: ${handles.length}\n`);
console.log("handle".padEnd(26), "inJSON", "pageStatus", "finalPath");
for (const h of handles) {
  const r = await fetch(`${origin}/products/${h}`, { redirect: "follow" });
  const finalPath = new URL(r.url).pathname;
  // What does the FINAL handle actually offer? This is the question both
  // methods were really asking, and method 2 skipped it on the rescue path.
  let finalIds = null;
  if (r.ok) {
    const jr = await fetch(origin + finalPath + ".js", { redirect: "follow" });
    if (jr.ok) { try { finalIds = (await jr.json()).variants.map((v) => String(v.id)); } catch {} }
  }
  const wants = pairs.filter((p) => p[1] === `/products/${h}`).map((p) => p[2]).filter(Boolean);
  const matched = finalIds ? wants.filter((w) => finalIds.includes(w)).length : 0;
  console.log(
    h.slice(0, 25).padEnd(26),
    String(map.has(h)).padEnd(6),
    String(r.status).padEnd(10),
    finalPath === `/products/${h}` ? "(same)" : finalPath,
    ` variants ${matched}/${wants.length}`
  );
}
