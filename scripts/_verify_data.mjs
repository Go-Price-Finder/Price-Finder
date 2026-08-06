import { existsSync } from "node:fs";
import { join } from "node:path";
import { KING_KOIL_PRODUCTS } from "../lib/king-koil-data.ts";
import { TSAR_BOMBA_PRODUCTS } from "../lib/tsar-bomba-data.ts";

function checkPartner(products, partnerId) {
  console.log(`\n=== ${partnerId}: ${products.length} products ===`);
  const slugs = new Set();
  let dupSlugs = 0,
    missingImages = 0,
    badDeepLink = 0,
    badPrice = 0;
  const pclickRe = /^https:\/\/www\.awin1\.com\/pclick\.php\?p=\d+&a=\d+&m=\d+$/;

  for (const p of products) {
    if (slugs.has(p.slug)) dupSlugs++;
    slugs.add(p.slug);
    for (const img of p.images) {
      const full = join("public", img.replace(/^\//, ""));
      if (!existsSync(full)) {
        missingImages++;
        console.log(`  MISSING IMAGE FILE: ${img}  (product: ${p.name})`);
      }
    }
    if (!pclickRe.test(p.deepLink)) {
      badDeepLink++;
      console.log(`  UNEXPECTED DEEP LINK FORMAT: ${p.deepLink}`);
    }
    if (typeof p.price !== "number" || p.price <= 0) badPrice++;
  }
  console.log(`Duplicate slugs: ${dupSlugs}`);
  console.log(`Missing image files: ${missingImages}`);
  console.log(`Deep links not matching pclick.php?p=&a=&m= format: ${badDeepLink}`);
  console.log(`Bad prices: ${badPrice}`);
}

checkPartner(KING_KOIL_PRODUCTS, "king-koil");
checkPartner(TSAR_BOMBA_PRODUCTS, "tsar-bomba");
