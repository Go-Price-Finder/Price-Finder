#!/usr/bin/env node
/** Three-way test (operator 2026-08-22), variant-identity rule:
 *  variant id still exists            -> KEEP (handle rename is irrelevant)
 *  variant param present but gone     -> REMOVE (different product)
 *  destination 404                    -> REMOVE (nothing)
 *  no variant param + live handle     -> KEEP  */
import { readFileSync } from "node:fs";
const [partner, resultsFile] = process.argv.slice(2);
const H = JSON.parse(readFileSync(resultsFile, "utf8"));
const P = JSON.parse(readFileSync(`scripts/_h-${partner}.json`, "utf8")).pairs;
const b = { KEEP: [], KEEP_RENAMED: [], KEEP_NO_VARIANT: [], DIFFERENT: [], NOTHING: [], UNCHECKED: [] };
for (const [slug, path, want] of P) {
  const h = H[path];
  if (!h) { b.UNCHECKED.push(slug); continue; }
  if (h.s !== 200) { b.NOTHING.push([slug, path, h.f]); continue; }
  if (!want) { b.KEEP_NO_VARIANT.push([slug, path]); continue; }
  if (h.ids && h.ids.includes(want)) { (h.m ? b.KEEP_RENAMED : b.KEEP).push([slug, path]); continue; }
  b.DIFFERENT.push([slug, path]);
}
const rm = b.DIFFERENT.length + b.NOTHING.length;
const keep = b.KEEP.length + b.KEEP_RENAMED.length + b.KEEP_NO_VARIANT.length;
console.log(`${partner}: ${P.length} links`);
console.log(`  KEEP exact              ${String(b.KEEP.length).padStart(5)}`);
console.log(`  KEEP handle renamed     ${String(b.KEEP_RENAMED.length).padStart(5)}`);
console.log(`  KEEP no variant param   ${String(b.KEEP_NO_VARIANT.length).padStart(5)}`);
console.log(`  REMOVE variant gone     ${String(b.DIFFERENT.length).padStart(5)}`);
console.log(`  REMOVE destination 404  ${String(b.NOTHING.length).padStart(5)}`);
console.log(`  unchecked               ${String(b.UNCHECKED.length).padStart(5)}`);
console.log(`  => KEEP ${keep} / REMOVE ${rm} (${(100*rm/P.length).toFixed(1)}%)`);
if (b.NOTHING.length) { console.log("  dead destinations:"); const s=new Set(b.NOTHING.map(x=>x[1])); for(const x of s) console.log("     "+x); }
if (b.DIFFERENT.length && b.DIFFERENT.length<=20) { console.log("  variant-gone:"); for(const x of b.DIFFERENT) console.log("     "+x[0]+"  "+x[1]); }
