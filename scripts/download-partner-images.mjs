#!/usr/bin/env node
/**
 * Downloads the EVDANCE and Golden Maple product images referenced by
 * lib/evdance-data.ts / lib/golden-maple-data.ts.
 *
 * IMPORTANT — why this script exists instead of the images already being
 * in this commit: the Claude Cowork sandbox (and its device-bridge VM)
 * that generated this import has no outbound network access to the
 * vendors' CDNs (cdn.shopify.com and Golden Maple's image host) — every
 * fetch attempt from that environment gets a 403 from its network proxy.
 * This script has no such restriction when run from an ordinary terminal
 * on your own machine, so run it here (from E:\Price Finder) to pull
 * down the actual product photos:
 *
 *   node scripts/download-partner-images.mjs
 *
 * Safe to re-run — it skips any file that already exists, so an
 * interrupted run can just be started again.
 */

import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const manifestPath = join(__dirname, "partner-images-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

const CONCURRENCY = 8;
let ok = 0;
let skipped = 0;
let failed = [];

async function downloadOne({ url, dest }) {
  const destPath = join(projectRoot, dest);
  if (existsSync(destPath)) {
    skipped++;
    return;
  }
  mkdirSync(dirname(destPath), { recursive: true });
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (PriceFinder image import)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const { writeFileSync } = await import("node:fs");
    writeFileSync(destPath, buf);
    ok++;
  } catch (err) {
    failed.push({ url, dest, error: String(err) });
  }
}

async function run() {
  console.log(`Downloading ${manifest.length} images (concurrency ${CONCURRENCY})...`);
  const queue = [...manifest];
  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) await downloadOne(item);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\nDone. ok=${ok} skipped=${skipped} failed=${failed.length}`);
  if (failed.length > 0) {
    console.log("\nFailed downloads:");
    for (const f of failed) console.log(`  ${f.dest}  <-  ${f.url}\n    ${f.error}`);
    process.exitCode = 1;
  }
}

run();
