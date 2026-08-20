/**
 * Partner logo acquisition + normalisation (operator ruling 2026-08-20).
 *
 * SELF-HOSTED, from the MERCHANT'S OWN SITE — never AWIN's CDN. Hotlinking
 * a network's asset host on production pages is fragile and outside our
 * control, which is why partners.logo_url has been NULL until now.
 * Same handling as product images: download, normalise, serve from our
 * domain (public/images/_logos/<partner-id>.webp).
 *
 * NORMALISATION is the part that decides whether this looks better or
 * worse than the monograms it replaces. Three things, all deliberate:
 *
 *  1. CONTAIN-FIT inside consistent padding. A wide wordmark and a square
 *     glyph must occupy the same optical weight, so every logo is fitted
 *     inside the same inner box of the same canvas — never cropped, never
 *     stretched.
 *  2. A LIGHT PLATE in BOTH themes. Most merchant logos are black (or
 *     near-black) artwork, either transparent or on white; on a dark
 *     surface they vanish. Flattening onto a light plate here — in the
 *     asset itself — means the rendered tile cannot disagree with the
 *     theme, and there is no per-theme asset to keep in sync.
 *  3. The plate colour is a measured value, not a guess: pure #ffffff
 *     against the dark card reads as a glaring chip, so the plate is
 *     #f4f4f2 and the tile adds its own hairline ring.
 *
 * Gated by lib/partner-compliance.json's logoUsagePermission — a partner
 * without a cleared permission is skipped here and keeps its monogram,
 * which renders at the identical footprint (no layout change, no hole).
 *
 * RUN: node scripts/fetch-partner-logos.mjs
 */
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const CANVAS = 256;      // square output
const PAD = 30;          // consistent optical padding
const PLATE = { r: 244, g: 244, b: 242 };
const OUT_DIR = join(process.cwd(), "public", "images", "_logos");

// Each entry names the merchant's OWN url. No network CDNs.
const SOURCES = {
  aaawave: "https://aaawave.com/cdn/shop/files/aaawave.png?v=1761757686&width=480",
};

const registry = JSON.parse(readFileSync("lib/partner-compliance.json", "utf8"));
const cleared = (id) => {
  const p = registry.partners[id]?.logoUsagePermission;
  return p === "confirmed" || p === "assessed-low-risk";
};

mkdirSync(OUT_DIR, { recursive: true });
const results = [];

for (const [id, url] of Object.entries(SOURCES)) {
  if (!cleared(id)) {
    results.push({ id, status: "SKIPPED — logoUsagePermission not cleared; keeps monogram" });
    continue;
  }
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (PriceFinder logo import)" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(raw).metadata();

    const inner = CANVAS - PAD * 2;
    const fitted = await sharp(raw)
      .resize(inner, inner, { fit: "inside", withoutEnlargement: false, background: { ...PLATE, alpha: 0 } })
      .toBuffer();

    const dest = join(OUT_DIR, `${id}.webp`);
    await sharp({
      create: { width: CANVAS, height: CANVAS, channels: 4, background: { ...PLATE, alpha: 1 } },
    })
      .composite([{ input: fitted, gravity: "centre" }])
      .webp({ quality: 90 })
      .toFile(dest);

    const outMeta = await sharp(dest).metadata();
    results.push({
      id,
      status: "OK",
      source: `${meta.width}x${meta.height} ${meta.format} alpha=${meta.hasAlpha}`,
      output: `${outMeta.width}x${outMeta.height} webp on plate rgb(${PLATE.r},${PLATE.g},${PLATE.b})`,
      path: `/images/_logos/${id}.webp`,
    });
  } catch (err) {
    results.push({ id, status: `FAILED — ${err instanceof Error ? err.message : String(err)}` });
  }
}

for (const r of results) console.log(JSON.stringify(r));
const failed = results.filter((r) => r.status.startsWith("FAILED"));
if (failed.length) process.exitCode = 1;
