#!/usr/bin/env node
/**
 * DESTINATION CHECK, stage 2 (operator brief 2026-08-22).
 *
 * Pulls the merchant's own `products.json` (Shopify's structured product
 * index: every published handle and every variant id) and scores our
 * links against it with the three-way test.
 *
 * WHY THIS SATISFIES §66. The rule is that text extraction from a
 * storefront is a hypothesis, never a finding — it exists because
 * WebFetch's MARKDOWN CONVERSION invented an availability state and a
 * wrong price. products.json is not extraction: it is the merchant's own
 * structured API, the same data the rendered page is built from. It is
 * cross-validated against a rendered browser check on a sample, and the
 * pagination is proved to have terminated rather than silently capped.
 *
 * IDENTITY RULE: a Shopify variant id is globally unique and stable, so
 * if the advertised variant id still exists under the advertised handle
 * the customer lands on exactly the item we advertised. A handle rename
 * alone is not "a different product".
 *
 * CAVEAT, stated rather than buried: products.json lists only products
 * published to the online-store channel. A handle absent from it is not
 * purchasable through that channel, which is the thing we care about,
 * but "absent" is not identical to "404" — absences are re-checked
 * individually against the live URL below.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [partner, origin] = process.argv.slice(2);
if (!partner || !origin) { console.error("usage: <partner> <origin>"); process.exit(2); }

const map = new Map();
let page = 1, total = 0;
const pageSizes = [];
while (page <= 40) {
  const r = await fetch(`${origin}/products.json?limit=250&page=${page}`, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; gopricefinder-link-audit/1.0)" },
  });
  if (!r.ok) { console.error(`  products.json page ${page}: HTTP ${r.status}`); break; }
  const j = await r.json();
  const n = (j.products || []).length;
  pageSizes.push(n);
  if (n === 0) break;
  for (const p of j.products) map.set(p.handle, p.variants.map((v) => String(v.id)));
  total += n; page++;
}
// PAGINATION TERMINATION CONTROL: the last page must be short or empty.
// A run of full pages ending at the loop cap means we silently truncated,
// and every "missing" handle after that point would be an artifact.
const lastFull = pageSizes.length && pageSizes[pageSizes.length - 1] === 250;
console.log(`${partner}: ${origin}/products.json -> ${total} products over pages [${pageSizes.join(", ")}]`);
if (lastFull) { console.error("FAIL: pagination hit the cap without a short page — result would be truncated."); process.exit(2); }
if (total === 0) { console.error("FAIL: zero products — that is a fetch failure, not an empty store."); process.exit(2); }

const pairs = JSON.parse(readFileSync(`scripts/_h-${partner}.json`, "utf8")).pairs;
const b = { KEEP: [], KEEP_NO_VARIANT: [], DIFFERENT: [], NOTHING: [] };
for (const [slug, path, want] of pairs) {
  const handle = path.replace(/^\/products\//, "");
  const ids = map.get(handle);
  if (!ids) { b.NOTHING.push([slug, handle]); continue; }
  if (!want) { b.KEEP_NO_VARIANT.push([slug, handle]); continue; }
  if (ids.includes(want)) { b.KEEP.push([slug, handle]); continue; }
  b.DIFFERENT.push([slug, handle, want]);
}

// RE-CHECK EVERY ABSENCE against the live URL. An unpublished-but-present
// handle and a genuine 404 are different findings, and products.json
// cannot tell them apart.
const absent = [...new Set(b.NOTHING.map((x) => x[1]))];
const absentStatus = {};
for (const h of absent) {
  try {
    const r = await fetch(`${origin}/products/${h}`, { redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; gopricefinder-link-audit/1.0)" } });
    const finalPath = new URL(r.url).pathname;
    let finalIds = null;
    if (r.ok && /^\/products\/[^/]+$/.test(finalPath)) {
      const jr = await fetch(origin + finalPath + ".js");
      if (jr.ok) { try { finalIds = (await jr.json()).variants.map((v) => String(v.id)); } catch {} }
    }
    absentStatus[h] = { status: r.status, finalPath, finalIds };
  } catch (e) { absentStatus[h] = { status: "ERR", err: String(e).slice(0, 60) }; }
}
// A 200 IS NOT A RESCUE. Shopify redirects a dead product handle all the
// way to the HOMEPAGE, which returns 200 — so "status 200 after following
// redirects" credited a silent bounce to `/` as a working product link.
// That was the whole disagreement between this method and the per-page
// browser check (tsar-bomba Default: 7 removals vs the true 25).
//
// A rescue now requires BOTH: the final URL is still a product page, and
// the advertised variant exists on it. Anything else is a bounce.
let rescued = 0;
for (const [slug, handle] of [...b.NOTHING]) {
  const a = absentStatus[handle];
  if (!a || a.status !== 200) continue;
  if (!/^\/products\/[^/]+$/.test(a.finalPath)) continue;   // landed on / or a collection
  const want = (pairs.find((x) => x[0] === slug) || [])[2];
  if (want && !(a.finalIds || []).includes(want)) continue;   // wrong variant on the new handle
  rescued++;
  b.NOTHING = b.NOTHING.filter((x) => !(x[0] === slug && x[1] === handle));
  b.KEEP_NO_VARIANT.push([slug, handle + " (renamed -> " + a.finalPath + ")"]);
}

const rm = b.DIFFERENT.length + b.NOTHING.length;
const keep = b.KEEP.length + b.KEEP_NO_VARIANT.length;
console.log(`  links: ${pairs.length}`);
console.log(`  KEEP   variant matches       ${String(b.KEEP.length).padStart(5)}`);
console.log(`  KEEP   no variant / renamed  ${String(b.KEEP_NO_VARIANT.length).padStart(5)}  (${rescued} rescued by a live redirect)`);
console.log(`  REMOVE variant gone          ${String(b.DIFFERENT.length).padStart(5)}`);
console.log(`  REMOVE handle gone           ${String(b.NOTHING.length).padStart(5)}`);
console.log(`  => KEEP ${keep} / REMOVE ${rm}  (${(100 * rm / pairs.length).toFixed(1)}%)`);
if (b.NOTHING.length) {
  console.log("  dead handles (re-checked live):");
  for (const h of [...new Set(b.NOTHING.map((x) => x[1]))]) {
    const a = absentStatus[h];
    const landed = a.finalPath === `/products/${h}` ? "(dead, no redirect)" : `-> ${a.finalPath}`;
    console.log(`     HTTP ${a.status}  ${h}  ${landed}`);
  }
}
writeFileSync(`scripts/_verdict-${partner}.json`, JSON.stringify(b, null, 2));
