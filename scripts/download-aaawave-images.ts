/**
 * One-shot image pass for the aaawave tranche-1 import, run after
 * imageUsagePermission flipped to "confirmed" (2026-08-19, findings §19).
 *
 * Deliberately NOT a re-run of scripts/import-partner.mjs: that script
 * downloads images BEFORE it wires lib/partners.ts, and its duplicate-entry
 * guard exits(1) after the download — a re-run would half-apply and rewrite
 * lib/aaawave-data.ts. This does only the missing half and is resumable
 * (existing files skipped), same contract as the importer's downloadAndResize.
 *
 * IMAGE SPEC — kept identical to import-partner.mjs's:
 *   fit inside 1600x1600, no enlargement, WebP quality 82,
 *   public/images/<partner-id>/<slug>.webp
 *
 * Run: npx tsx scripts/download-aaawave-images.ts
 */
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import Papa from "papaparse";
import sharp from "sharp";
import { AAAWAVE_PRODUCTS } from "../lib/aaawave-data";

const ROOT = process.cwd();

// Source URLs live in the staged CSV keyed by title; destination paths come
// from the generated data file keyed by name. Titles are unique in this feed
// (1,683 rows, 1,683 distinct titles, measured at import), so the join is safe.
const rows = Papa.parse<Record<string, string>>(
  readFileSync("scratch/aaawave-tranche1.csv", "utf-8"),
  { header: true, skipEmptyLines: true }
).data;
const urlByName = new Map(
  rows.map((r) => [String(r.title ?? "").trim(), String(r.image_link ?? "").trim()])
);
console.log(`${AAAWAVE_PRODUCTS.length} products; ${urlByName.size} CSV title->image_link pairs.`);

async function downloadAndResize(url: string, destRelPath: string) {
  const destPath = join(ROOT, "public", destRelPath.replace(/^\//, ""));
  if (existsSync(destPath)) return { status: "skipped" as const };
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
    return { status: "ok" as const };
  } catch (err) {
    return { status: "failed" as const, error: String(err) };
  }
}

async function main() {
  const jobs: { url: string; dest: string; name: string }[] = [];
  const noUrl: string[] = [];
  for (const p of AAAWAVE_PRODUCTS) {
    const url = urlByName.get(p.name.trim());
    if (!url) {
      noUrl.push(p.name);
      continue;
    }
    for (const dest of p.images) jobs.push({ url, dest, name: p.name });
  }
  if (noUrl.length) console.log(`${noUrl.length} product(s) with no CSV image_link match:`, noUrl.slice(0, 5));

  console.log(`Downloading ${jobs.length} image(s) (WebP, max 1600x1600, q82)...`);
  const CONCURRENCY = 8;
  const result = { ok: 0, skipped: 0, failed: [] as { dest: string; error: string }[] };
  let cursor = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < jobs.length) {
        const job = jobs[cursor++];
        const r = await downloadAndResize(job.url, job.dest);
        if (r.status === "ok") result.ok++;
        else if (r.status === "skipped") result.skipped++;
        else result.failed.push({ dest: job.dest, error: r.error });
        const done = result.ok + result.skipped + result.failed.length;
        if (done % 100 === 0) console.log(`  ${done}/${jobs.length}`);
      }
    })
  );
  console.log(`ok=${result.ok} skipped=${result.skipped} failed=${result.failed.length}`);
  for (const f of result.failed.slice(0, 10)) console.log(`  FAILED ${f.dest}: ${f.error}`);
  if (result.failed.length) process.exitCode = 1;

}

main();
