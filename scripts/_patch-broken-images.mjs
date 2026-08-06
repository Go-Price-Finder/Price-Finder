import { readFileSync, writeFileSync } from "node:fs";

const path = "lib/tsar-bomba-data.ts";
let src = readFileSync(path, "utf-8");

const brokenSlugs = [
  "tsar-bomba-men-s-automatic-skeleton-watch-interchangeable-luxury-design-green-at",
  "tsar-bomba-men-s-ceramic-automatic-watch-gray-45mm-miyota-9100-movement-men-s-lu",
  "tsar-bomba-men-s-ceramic-automatic-watch-white-45mm-miyota-9100-movement-men-s-l",
  "tsar-bomba-men-s-ceramic-automatic-watch-yellow-45mm-miyota-9100-movement-men-s",
  "tsar-bomba-women-s-quartz-watch-blue-35mm-sapphire-crystal-swiss-movement-5atm-w",
  "tsar-bomba-men-s-ceramic-automatic-watch-blue-45mm-sapphire-crystal-miyota-movem",
  "tsar-bomba-men-s-quartz-chronograph-watch-black-stainless-steel-bezel-case-tonne",
  "tsar-bomba-men-s-automatic-watch-elegant-white-stainless-steel-case-carbon-fiber",
  "tsar-bomba-men-s-carbon-fiber-automatic-watch-carbon-fiber-dial-gold-black-elect",
  "atomic-interchangeable-automatic-watch-zirconia-diamond-venus",
];

const PLACEHOLDER = "/images/_placeholders/image-pending.png";
let patched = 0;

for (const slug of brokenSlugs) {
  const marker = `slug: "${slug}",`;
  const start = src.indexOf(marker);
  if (start === -1) {
    console.log(`NOT FOUND: ${slug}`);
    continue;
  }
  const blockEnd = src.indexOf("\n  },\n", start);
  if (blockEnd === -1) {
    console.log(`NO BLOCK END: ${slug}`);
    continue;
  }
  const block = src.slice(start, blockEnd);
  const newBlock = block
    .replace(/image: "[^"]*",/, `image: ${JSON.stringify(PLACEHOLDER)},`)
    .replace(/images: \[[^\]]*\],/, `images: [${JSON.stringify(PLACEHOLDER)}],`);
  if (newBlock === block) {
    console.log(`NO CHANGE (pattern mismatch): ${slug}`);
    continue;
  }
  src = src.slice(0, start) + newBlock + src.slice(blockEnd);
  patched++;
}

console.log(`Patched ${patched} of ${brokenSlugs.length} products.`);
writeFileSync(path, src);
