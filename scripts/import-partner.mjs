#!/usr/bin/env node
/**
 * Generic partner-CSV import automation.
 *
 * WHAT THIS DOES END TO END, for a CSV that roughly matches the default
 * (Awin-feed-style) column names or that you've pointed at with
 * --mapping:
 *   1. Parses the CSV and validates every row (required fields, positive
 *      price, well-formed deep link, description length) — bad rows are
 *      skipped with a warning, never silently dropped without saying so.
 *   2. Auto-categorizes every product into a parent category by keyword,
 *      using the SAME rules file (config/category-rules.json) the live
 *      site uses to render category tiles — so a product is guaranteed to
 *      land in the same parent category here as it will on the site.
 *   3. Downloads and resizes every product image (see IMAGE SPEC below),
 *      skipping any file that already exists so an interrupted run can
 *      just be re-run.
 *   4. Generates lib/<partner-id>-data.ts from the same shape every other
 *      partner's data file already uses.
 *   5. Wires the partner into lib/partners.ts automatically — inserts an
 *      import line and a PARTNERS array entry at the two marker comments
 *      in that file. This is the step that got missed by hand during the
 *      EVDANCE/Golden Maple import (see lib/partners.ts's own header
 *      comment and the project's build-notes doc) and caused a fully
 *      "complete-looking" import to silently show 0 products on the live
 *      site. Doing it here, mechanically, removes that failure mode.
 *   6. Runs `tsc --noEmit` and `eslint` against the result and reports
 *      pass/fail, so a broken import is caught immediately instead of
 *      discovered later.
 *
 * WHAT THIS CANNOT PROMISE, honestly: "drop in ANY CSV, zero config" only
 * holds when the CSV's column names are close enough to the DEFAULT_MAPPING
 * candidates below (Awin-feed-style — search_price/price, image_link,
 * merchant_deep_link, category, etc. — the shape EVDANCE's and Golden
 * Maple's feeds already used). A CSV with genuinely different column
 * names needs a small --mapping JSON telling the script which header
 * means what (see --help). That's a 10-line file, not a rewrite — but
 * claiming this script never needs it for literally arbitrary unknown
 * spreadsheets would be overselling it.
 *
 * IMAGE SPEC (see also DESIGN_SPEC.md):
 *   - Format: WebP (quality 82) — matches the majority of the images
 *     already in this repo and gives the best size/quality tradeoff for
 *     product photography.
 *   - Dimensions: resized to fit within 1600×1600 preserving aspect ratio
 *     (`withoutEnlargement`, so a smaller source photo is never upscaled
 *     and blurred). Next.js's own image pipeline (`next/image`) generates
 *     the actual responsive srcset sizes a browser downloads from this
 *     one canonical file — there's no need to pre-generate multiple
 *     physical sizes per product.
 *   - Folder structure: public/images/<partner-id>/<product-slug>.webp
 *     for the primary photo, <product-slug>-2.webp, -3.webp, ... for any
 *     additional gallery photos the feed provides.
 *
 * USAGE:
 *   node scripts/import-partner.mjs \
 *     --csv path/to/feed.csv \
 *     --partner-id acme-co \
 *     --partner-name "Acme Co" \
 *     --tagline "Widgets, gadgets & gizmos" \
 *     [--mapping path/to/mapping.json] \
 *     [--awin-mid 123456 --awin-affid 3002879]  (wrap bare product URLs \
 *        Awin-style, matching how every existing partner's deep links work) \
 *     [--skip-images]   (data file only, download images in a later pass) \
 *     [--dry-run]       (parse + classify + report, write nothing) \
 *     [--no-verify]     (skip the automatic tsc/eslint check at the end)
 *
 * Requires network access to the CSV's image URLs to actually download
 * images — like every prior partner import in this repo, that means
 * running this from a real terminal with internet access (not the Cowork
 * cloud sandbox or its device-bridge VM, neither of which can reach
 * arbitrary vendor CDNs). --skip-images lets you generate and review the
 * data file first, then re-run without --skip-images later to fetch
 * images once you're on a machine with the right network access.
 */

import { parseArgs } from "node:util";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import Papa from "papaparse";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ---------------------------------------------------------------------
// 1. CLI args
// ---------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    csv: { type: "string" },
    "partner-id": { type: "string" },
    "partner-name": { type: "string" },
    tagline: { type: "string" },
    mapping: { type: "string" },
    "awin-mid": { type: "string" },
    "awin-affid": { type: "string" },
    "skip-images": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    "no-verify": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

function printUsage() {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf-8").split("*/")[0]);
}

if (args.help) {
  printUsage();
  process.exit(0);
}
if (!args.csv || !args["partner-id"] || !args["partner-name"]) {
  console.error("Missing required arguments. --csv, --partner-id, and --partner-name are all required.\n");
  printUsage();
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(args["partner-id"])) {
  console.error(`--partner-id must be kebab-case (lowercase letters, digits, hyphens only). Got: "${args["partner-id"]}"`);
  process.exit(1);
}

const PARTNER_ID = args["partner-id"];
const PARTNER_NAME = args["partner-name"];
const TAGLINE = args.tagline ?? "";

// ---------------------------------------------------------------------
// 2. Column mapping
// ---------------------------------------------------------------------

// Candidate header names tried in order, case-insensitively, when no
// --mapping override supplies an explicit header for that field. These
// match the Awin-feed convention already used by every partner imported
// into this repo so far.
const DEFAULT_MAPPING_CANDIDATES = {
  name: ["product_name", "name", "title", "product name"],
  description: ["description", "product_description", "desc"],
  price: ["search_price", "sale_price", "price", "current_price"],
  originalPrice: ["rrp_price", "rrp", "list_price", "original_price", "was_price"],
  category: ["category", "product_type", "merchant_category", "product_category"],
  deepLink: ["deep_link", "merchant_deep_link", "affiliate_url", "product_url", "url"],
  image: ["image_link", "image_url", "image", "large_image", "photo"],
  additionalImages: ["additional_image_link", "additional_images", "gallery"],
};

const userMapping = args.mapping
  ? JSON.parse(readFileSync(args.mapping, "utf-8"))
  : {};

function resolveColumn(headers, field) {
  if (userMapping[field]) {
    if (!headers.includes(userMapping[field])) {
      throw new Error(
        `--mapping specifies "${userMapping[field]}" for "${field}", but that column isn't in the CSV. Available columns: ${headers.join(", ")}`
      );
    }
    return userMapping[field];
  }
  const candidates = DEFAULT_MAPPING_CANDIDATES[field] ?? [];
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  for (const candidate of candidates) {
    const idx = lowerHeaders.indexOf(candidate.toLowerCase());
    if (idx !== -1) return headers[idx];
  }
  return null; // optional fields (originalPrice, additionalImages) may legitimately be absent
}

// ---------------------------------------------------------------------
// 3. Category classification — reads the SAME rules file the live site
//    uses (lib/category-map.ts), so a product's parent category here is
//    guaranteed identical to what it'll be on the site.
// ---------------------------------------------------------------------

const categoryRules = JSON.parse(
  readFileSync(join(ROOT, "config", "category-rules.json"), "utf-8")
);

function getParentCategory(rawCategory) {
  const haystack = (rawCategory || "").toLowerCase();
  for (const rule of categoryRules.parents) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return rule.name;
    }
  }
  return categoryRules.fallback.name;
}

// ---------------------------------------------------------------------
// 4. Helpers
// ---------------------------------------------------------------------

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parsePrice(raw) {
  if (raw == null || raw === "") return null;
  const cleaned = String(raw).replace(/[^0-9.]/g, "");
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function buildDeepLink(raw) {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    if (args["awin-mid"] && args["awin-affid"] && !raw.includes("awin1.com")) {
      // A bare merchant URL, but Awin credentials were supplied — wrap it
      // the same way every existing partner's deep link is wrapped.
      return `https://www.awin1.com/cread.php?awinmid=${args["awin-mid"]}&awinaffid=${args["awin-affid"]}&ued=${encodeURIComponent(raw)}`;
    }
    return raw;
  }
  return null;
}

function splitImages(raw) {
  if (!raw) return [];
  return raw
    .split(/[|,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------
// 5. Parse + validate + classify
// ---------------------------------------------------------------------

const csvRaw = readFileSync(args.csv, "utf-8");
const parsed = Papa.parse(csvRaw, { header: true, skipEmptyLines: true });
if (parsed.errors.length > 0) {
  console.warn(`CSV parse warnings (${parsed.errors.length}) — continuing, but review these:`);
  for (const e of parsed.errors.slice(0, 10)) console.warn(`  row ${e.row}: ${e.message}`);
}

const headers = parsed.meta.fields ?? [];
const columns = {
  name: resolveColumn(headers, "name"),
  description: resolveColumn(headers, "description"),
  price: resolveColumn(headers, "price"),
  originalPrice: resolveColumn(headers, "originalPrice"),
  category: resolveColumn(headers, "category"),
  deepLink: resolveColumn(headers, "deepLink"),
  image: resolveColumn(headers, "image"),
  additionalImages: resolveColumn(headers, "additionalImages"),
};

for (const required of ["name", "price", "deepLink", "image"]) {
  if (!columns[required]) {
    console.error(
      `Could not find a column for required field "${required}" in the CSV headers: ${headers.join(", ")}\n` +
        `Pass --mapping with an explicit { "${required}": "<your header name>" } entry.`
    );
    process.exit(1);
  }
}

console.log("Resolved column mapping:");
for (const [field, header] of Object.entries(columns)) {
  console.log(`  ${field.padEnd(18)} -> ${header ?? "(not found — optional)"}`);
}
console.log("");

const seenSlugs = new Map(); // slug -> count, for de-duplication
const products = [];
const warnings = [];
let skippedRows = 0;

for (const [i, row] of parsed.data.entries()) {
  const rowNum = i + 2; // +1 for header row, +1 for 1-indexing
  const name = (row[columns.name] || "").trim();
  const price = parsePrice(row[columns.price]);
  const rawOriginal = columns.originalPrice ? parsePrice(row[columns.originalPrice]) : null;
  const rawCategory = (columns.category ? row[columns.category] : "") || "Uncategorized";
  const rawDeepLink = columns.deepLink ? row[columns.deepLink] : "";
  const deepLink = buildDeepLink(rawDeepLink);
  const primaryImage = columns.image ? (row[columns.image] || "").trim() : "";
  const description = columns.description ? (row[columns.description] || "").trim() : "";

  if (!name) {
    warnings.push(`row ${rowNum}: skipped — no product name`);
    skippedRows++;
    continue;
  }
  if (price == null || price <= 0) {
    warnings.push(`row ${rowNum} ("${name}"): skipped — missing or non-positive price`);
    skippedRows++;
    continue;
  }
  if (!deepLink) {
    warnings.push(`row ${rowNum} ("${name}"): skipped — no valid deep link (need a full https:// URL, or --awin-mid/--awin-affid to wrap a bare product URL)`);
    skippedRows++;
    continue;
  }
  if (!primaryImage) {
    warnings.push(`row ${rowNum} ("${name}"): skipped — no image URL`);
    skippedRows++;
    continue;
  }
  if (description.length > 0 && description.length < 10) {
    warnings.push(`row ${rowNum} ("${name}"): description is suspiciously short (${description.length} chars) — check the source feed, this may be a data gap rather than a real description`);
  }

  let originalPrice;
  if (rawOriginal != null && rawOriginal > price) {
    originalPrice = rawOriginal;
  }

  let slug = slugify(name);
  const count = seenSlugs.get(slug) ?? 0;
  seenSlugs.set(slug, count + 1);
  if (count > 0) {
    warnings.push(`row ${rowNum} ("${name}"): slug "${slug}" collided with an earlier row — de-duplicated to "${slug}-${count + 1}"`);
    slug = `${slug}-${count + 1}`;
  }

  const galleryUrls = columns.additionalImages ? splitImages(row[columns.additionalImages]) : [];
  const allImageUrls = [primaryImage, ...galleryUrls];
  const imagePaths = allImageUrls.map((_, idx) =>
    idx === 0 ? `/images/${PARTNER_ID}/${slug}.webp` : `/images/${PARTNER_ID}/${slug}-${idx + 1}.webp`
  );

  products.push({
    slug,
    name,
    description: description || `${name} from ${PARTNER_NAME}.`,
    price,
    originalPrice,
    deepLink,
    image: imagePaths[0],
    images: imagePaths,
    imageUrls: allImageUrls, // not written to the data file — used for downloading below
    category: rawCategory.trim() || "Uncategorized",
    parentCategory: getParentCategory(rawCategory),
  });
}

const categoryBreakdown = new Map();
for (const p of products) {
  const key = `${p.category} -> ${p.parentCategory}`;
  categoryBreakdown.set(key, (categoryBreakdown.get(key) ?? 0) + 1);
}

console.log(`Parsed ${parsed.data.length} rows: ${products.length} valid, ${skippedRows} skipped.`);
if (warnings.length > 0) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings.slice(0, 30)) console.log(`  - ${w}`);
  if (warnings.length > 30) console.log(`  ... and ${warnings.length - 30} more`);
}
console.log(`\nCategory -> parent category breakdown:`);
for (const [key, count] of [...categoryBreakdown.entries()].sort()) {
  console.log(`  ${count.toString().padStart(4)}  ${key}`);
}

if (products.length === 0) {
  console.error("\nNo valid products to import. Stopping.");
  process.exit(1);
}

if (args["dry-run"]) {
  console.log("\n--dry-run: not writing any files, not downloading any images.");
  process.exit(0);
}

// ---------------------------------------------------------------------
// 6. Download + resize images
// ---------------------------------------------------------------------

async function downloadAndResize(url, destRelPath) {
  const destPath = join(ROOT, "public", destRelPath.replace(/^\//, ""));
  if (existsSync(destPath)) return { status: "skipped" };
  mkdirSync(dirname(destPath), { recursive: true });
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (PriceFinder image import)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await sharp(buf)
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(destPath);
    return { status: "ok" };
  } catch (err) {
    return { status: "failed", error: String(err) };
  }
}

let imageResults = { ok: 0, skipped: 0, failed: [] };

if (!args["skip-images"]) {
  console.log(`\nDownloading and resizing images (WebP, max 1600x1600)...`);
  const CONCURRENCY = 8;
  const jobs = products.flatMap((p) =>
    p.imageUrls.map((url, idx) => ({ url, dest: p.images[idx], product: p.name }))
  );
  const queue = [...jobs];
  async function worker() {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) continue;
      const result = await downloadAndResize(job.url, job.dest);
      if (result.status === "ok") imageResults.ok++;
      else if (result.status === "skipped") imageResults.skipped++;
      else imageResults.failed.push({ ...job, error: result.error });
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Images: ${imageResults.ok} downloaded, ${imageResults.skipped} already existed, ${imageResults.failed.length} failed.`);
  if (imageResults.failed.length > 0) {
    console.log("Failed image downloads (data file still references these paths — re-run this script later, from a machine with network access to these URLs, to retry just the missing ones):");
    for (const f of imageResults.failed.slice(0, 20)) {
      console.log(`  ${f.product}: ${f.url} -> ${f.error}`);
    }
  }
} else {
  console.log("\n--skip-images: not downloading. Re-run without --skip-images later to fetch them.");
}

// ---------------------------------------------------------------------
// 7. Generate lib/<partner-id>-data.ts
// ---------------------------------------------------------------------

const pascalId = PARTNER_ID.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());
const upperId = PARTNER_ID.replace(/-/g, "_").toUpperCase();
const categoryTypeName = `${pascalId}ProductCategory`;

const rawCategories = [...new Set(products.map((p) => p.category))];

function tsQuote(str) {
  return JSON.stringify(str);
}

function productToTs(p) {
  const lines = [
    `  {`,
    `    slug: ${tsQuote(p.slug)},`,
    `    name: ${tsQuote(p.name)},`,
    `    description: ${tsQuote(p.description)},`,
    `    price: ${p.price},`,
  ];
  if (p.originalPrice != null) lines.push(`    originalPrice: ${p.originalPrice},`);
  lines.push(`    deepLink: ${tsQuote(p.deepLink)},`);
  lines.push(`    image: ${tsQuote(p.image)},`);
  lines.push(`    images: [${p.images.map(tsQuote).join(", ")}],`);
  lines.push(`    category: ${tsQuote(p.category)},`);
  lines.push(`  },`);
  return lines.join("\n");
}

const dataFileContents = `/**
 * ${PARTNER_NAME} is a real vendor catalog, imported via
 * scripts/import-partner.mjs from ${args.csv.split("/").pop()} on
 * ${new Date().toISOString().slice(0, 10)}. ${products.length} products across
 * ${rawCategories.length} categories.
 *
 * Follows the same lightweight per-partner model as every other partner
 * data file (see lib/brooklyn-delhi-data.ts): one real vendor, one real
 * price (with a real originalPrice only when the source feed's own price
 * fields showed an actual markdown — never fabricated), and one real
 * outbound affiliate/purchase link per product.
 *
 * Images: resized to fit within 1600x1600 and converted to WebP by the
 * import script, saved to public/images/${PARTNER_ID}/.
 */

export type ${categoryTypeName} =
${rawCategories.map((c) => `  | ${tsQuote(c)}`).join("\n")};

export type ${pascalId}Product = {
  slug: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  deepLink: string;
  image: string;
  images: string[];
  category: ${categoryTypeName};
};

export const ${upperId}_CATEGORIES: ${categoryTypeName}[] = [
${rawCategories.map((c) => `  ${tsQuote(c)},`).join("\n")}
];

export const ${upperId}_PRODUCTS: ${pascalId}Product[] = [
${products.map(productToTs).join("\n")}
];
`;

const dataFilePath = join(ROOT, "lib", `${PARTNER_ID}-data.ts`);
writeFileSync(dataFilePath, dataFileContents);
console.log(`\nWrote ${dataFilePath.replace(ROOT + "/", "")} (${products.length} products).`);

// ---------------------------------------------------------------------
// 8. Wire into lib/partners.ts at the marker comments
// ---------------------------------------------------------------------

const partnersPath = join(ROOT, "lib", "partners.ts");
let partnersSrc = readFileSync(partnersPath, "utf-8");

const importMarker = "// PARTNER_IMPORTS_MARKER";
const registryMarker = "  // PARTNER_REGISTRY_MARKER";

if (!partnersSrc.includes(importMarker) || !partnersSrc.includes(registryMarker)) {
  console.error(
    `\nlib/partners.ts is missing PARTNER_IMPORTS_MARKER and/or PARTNER_REGISTRY_MARKER — ` +
      `can't auto-wire this partner in. The data file was still written to ${dataFilePath}; ` +
      `you'll need to wire it into lib/partners.ts by hand (see that file's header comment).`
  );
  process.exit(1);
}

if (partnersSrc.includes(`"${PARTNER_ID}"`)) {
  console.error(
    `\nlib/partners.ts already has an entry mentioning "${PARTNER_ID}" — refusing to add a ` +
      `duplicate. If you're re-running this import to update data, edit lib/${PARTNER_ID}-data.ts ` +
      `directly (it's already regenerated above); no change to lib/partners.ts is needed for an update.`
  );
  process.exit(1);
}

const importLine = `import { ${upperId}_PRODUCTS, type ${pascalId}Product } from "./${PARTNER_ID}-data";\n`;
partnersSrc = partnersSrc.replace(importMarker, importLine + importMarker);

const normalizedVar = `${upperId}_REAL_PRODUCTS`;
const normalizeLine =
  `const ${normalizedVar} = ${upperId}_PRODUCTS.map((p: ${pascalId}Product) =>\n` +
  `  normalizeProduct(p, "${PARTNER_ID}", "${PARTNER_NAME}")\n` +
  `);\n`;
// Insert the normalize call right before the PARTNERS array declaration.
partnersSrc = partnersSrc.replace(
  "export const PARTNERS: Partner[] = [",
  `${normalizeLine}\nexport const PARTNERS: Partner[] = [`
);

const registryEntry =
  `  {\n` +
  `    id: "${PARTNER_ID}",\n` +
  `    name: "${PARTNER_NAME}",\n` +
  `    tagline: "${TAGLINE.replace(/"/g, '\\"')}",\n` +
  `    href: "/${PARTNER_ID}",\n` +
  `    products: ${normalizedVar},\n` +
  `  },\n`;
partnersSrc = partnersSrc.replace(registryMarker, registryEntry + registryMarker);

writeFileSync(partnersPath, partnersSrc);
console.log(`Wired "${PARTNER_ID}" into lib/partners.ts (import + PARTNERS entry).`);

console.log(
  `\nStill needed before this partner is live:\n` +
    `  - app/${PARTNER_ID}/page.tsx (category-grouped listing) and app/${PARTNER_ID}/[slug]/page.tsx ` +
    `(product detail page) — copy an existing partner's (e.g. app/evdance/) and swap the partner id/name.\n` +
    `  - Commit and push.`
);

// ---------------------------------------------------------------------
// 9. Self-verify
// ---------------------------------------------------------------------

if (!args["no-verify"]) {
  console.log(`\nRunning tsc --noEmit and eslint to verify the generated code compiles cleanly...`);
  let ok = true;
  try {
    execSync("npx tsc --noEmit", { cwd: ROOT, stdio: "pipe" });
    console.log("  tsc --noEmit: PASS");
  } catch (err) {
    ok = false;
    console.error("  tsc --noEmit: FAIL\n" + err.stdout?.toString());
  }
  try {
    execSync("npx eslint lib/" + PARTNER_ID + "-data.ts lib/partners.ts", { cwd: ROOT, stdio: "pipe" });
    console.log("  eslint: PASS");
  } catch (err) {
    ok = false;
    console.error("  eslint: FAIL\n" + err.stdout?.toString());
  }
  if (!ok) {
    console.error("\nVerification failed — review the errors above before committing.");
    process.exitCode = 1;
  } else {
    console.log("\nAll checks passed.");
  }
}
