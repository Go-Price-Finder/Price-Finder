#!/usr/bin/env node
/**
 * One-time helper: fetches fresh AWIN feed CSVs for king-koil and tsar-bomba
 * (all active English tsar-bomba feeds, matching the original 2026-07-29
 * import's Default+US merge) and saves the raw CSV text to scripts/_*.csv.
 *
 * Run this yourself: node --env-file=.env.local scripts/_fetch-fresh-feeds.mjs
 */
import { gunzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import Papa from "papaparse";

const FEED_LIST_URL = process.env.AWIN_FEED_LIST_URL;
if (!FEED_LIST_URL) {
  console.error("Missing AWIN_FEED_LIST_URL — run with: node --env-file=.env.local scripts/_fetch-fresh-feeds.mjs");
  process.exit(1);
}

async function fetchFeedList() {
  const res = await fetch(FEED_LIST_URL);
  if (!res.ok) throw new Error(`Feed list fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
}

async function downloadFeedRaw(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Feed download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  try {
    return gunzipSync(buf).toString("utf8");
  } catch {
    return buf.toString("utf8"); // not gzipped
  }
}

async function main() {
  const feedList = await fetchFeedList();

  console.log("King Koil:");
  const kkCandidates = feedList.filter(
    (r) => r["Advertiser Name"] === "King Koil" && r["Membership Status"] === "active"
  );
  for (const c of kkCandidates) {
    console.log(`  Feed ${c["Feed ID"]} "${c["Feed Name"] || "Default"}" (${c.Language})`);
  }
  const kkChosen =
    kkCandidates.find((c) => c["Language"] === "English" && !c["Vertical"]) ??
    kkCandidates.find((c) => c["Language"] === "English") ??
    kkCandidates[0];
  if (kkChosen) {
    const csv = await downloadFeedRaw(kkChosen.URL);
    writeFileSync("scripts/_king-koil-feed-fresh.csv", csv);
    console.log(`  -> saved scripts/_king-koil-feed-fresh.csv (feed ${kkChosen["Feed ID"]})`);
  } else {
    console.log("  No active King Koil feed found — nothing saved.");
  }

  console.log("\nTsarbomba:");
  const tbCandidates = feedList.filter(
    (r) =>
      r["Advertiser Name"] === "Tsarbomba" &&
      r["Membership Status"] === "active" &&
      r["Language"] === "English"
  );
  console.log(`  ${tbCandidates.length} active English feed(s) found.`);
  let idx = 0;
  for (const c of tbCandidates) {
    idx++;
    const csv = await downloadFeedRaw(c.URL);
    const nameSlug = (c["Feed Name"] || "default").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const outPath = `scripts/_tsarbomba-feed-fresh-${idx}-${nameSlug}.csv`;
    writeFileSync(outPath, csv);
    console.log(`  Feed ${c["Feed ID"]} "${c["Feed Name"] || "Default"}" (${c.Language}) -> saved ${outPath}`);
  }

  console.log("\nDone. Tell Claude which files were saved so it can continue.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
