#!/usr/bin/env -S npx tsx
/**
 * Manual, read-only AWIN account + catalog audit — pulls joined/pending
 * programme relationships, the full datafeed list, and a deeper per-
 * product audit for a chosen set of advertisers, then prints a human
 * -readable report. Never touches live site data, never writes to the
 * repo, never commits anything.
 *
 * Run manually (not scheduled) with:
 *   npx tsx scripts/awin-status-report.ts
 *
 * Requires in .env (gitignored): AWIN_API_TOKEN, AWIN_PUBLISHER_ID,
 * AWIN_FEED_LIST_URL. tsx loads .env itself is NOT automatic — run with
 * `node --env-file=.env` in front, same as before:
 *   node --env-file=.env --import tsx scripts/awin-status-report.ts
 *
 * Endpoint reference (help.awin.com/apidocs, verified live 2026-07-28):
 *   GET https://api.awin.com/publishers/{publisherId}/programmes
 *     ?relationship=joined|pending|suspended|rejected|notjoined
 *     Header: Authorization: Bearer {accessToken}
 *   The published docs show `Authorization: {accessToken}` with no
 *   "Bearer" prefix — that format returns 401. The prefix is required.
 *
 * The datafeed list (AWIN_FEED_LIST_URL) is a *separate* credential from
 * the Publisher API token above — AWIN's own docs say so, and it was
 * confirmed live (the token-based apikey URL 500'd; the dashboard-issued
 * feed-list URL works). It's a CSV of every advertiser feed available to
 * this publisher, each row carrying its own per-feed download URL.
 *
 * FEED_AUDIT_TARGETS below controls which advertisers get the deep
 * per-product pull (count, category mapping, missing-field check,
 * compliance gate). Edit that list to audit different partners.
 */

import { gunzipSync } from "node:zlib";
import Papa from "papaparse";
import { checkImportGate } from "../lib/partner-compliance.js";
import { mapProductToCategory } from "../lib/category-mapper.js";

const TOKEN = process.env.AWIN_API_TOKEN;
const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;
const FEED_LIST_URL = process.env.AWIN_FEED_LIST_URL;

if (!TOKEN || !PUBLISHER_ID) {
  console.error(
    "Missing AWIN_API_TOKEN or AWIN_PUBLISHER_ID — set them in .env and run with " +
      "`node --env-file=.env --import tsx scripts/awin-status-report.ts`."
  );
  process.exit(1);
}

const API_BASE = "https://api.awin.com";

/** advertiser name substring → partner-compliance.json id, for the deep audit */
const FEED_AUDIT_TARGETS: { match: string; partnerId: string }[] = [
  { match: "Canvas Vows", partnerId: "canvas-vows" },
  { match: "King Koil", partnerId: "king-koil" },
  { match: "Tsarbomba", partnerId: "tsar-bomba" },
];

type ProgrammeRow = {
  id?: number;
  name?: string;
  status?: string;
  linkStatus?: string;
  currencyCode?: string;
  validDomains?: { domain: string }[];
};

async function fetchProgrammes(relationship: string) {
  const url = `${API_BASE}/publishers/${PUBLISHER_ID}/programmes?relationship=${relationship}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) return { ok: false as const, status: res.status, body: text };
  try {
    return { ok: true as const, data: JSON.parse(text) as ProgrammeRow[] };
  } catch {
    return { ok: false as const, status: res.status, body: text };
  }
}

async function fetchAccounts() {
  const url = `${API_BASE}/accounts?type=publisher`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) return { ok: false as const, status: res.status, body: text };
  try {
    return { ok: true as const, data: JSON.parse(text) };
  } catch {
    return { ok: false as const, status: res.status, body: text };
  }
}

type FeedListRow = {
  "Advertiser ID": string;
  "Advertiser Name": string;
  "Primary Region": string;
  "Membership Status": string;
  "Datafeed Format": string;
  "Feed ID": string;
  "Feed Name": string;
  Language: string;
  Vertical: string;
  "Last Imported": string;
  "Last Checked": string;
  "No of products": string;
  URL: string;
};

async function fetchFeedList(): Promise<FeedListRow[]> {
  if (!FEED_LIST_URL) return [];
  const res = await fetch(FEED_LIST_URL);
  if (!res.ok) throw new Error(`Feed list fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  const parsed = Papa.parse<FeedListRow>(text, { header: true, skipEmptyLines: true });
  return parsed.data;
}

async function downloadAndParseFeed(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Feed download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Feed URLs are gzip-compressed CSV per the feed list's own URL params
  // (compression/gzip) — decompress before parsing.
  const csv = gunzipSync(buf).toString("utf8");
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  return parsed.data;
}

function printSection(title: string) {
  console.log(`\n${"=".repeat(64)}\n${title}\n${"=".repeat(64)}`);
}

function printProgrammeRows(programmes: ProgrammeRow[]) {
  if (!Array.isArray(programmes) || programmes.length === 0) {
    console.log("  (none)");
    return;
  }
  for (const p of programmes) {
    const domain = p.validDomains?.[0]?.domain ?? "";
    console.log(
      `  #${p.id ?? "?"}  ${p.name ?? "(unnamed)"}` +
        `  [status: ${p.status ?? "unknown"}]` +
        `  [link: ${p.linkStatus ?? "unknown"}]` +
        (domain ? `  (${domain})` : "")
    );
  }
}

const REQUIRED_FIELD_CANDIDATES: Record<string, string[]> = {
  name: ["product_name"],
  price: ["search_price"],
  deepLink: ["aw_deep_link", "merchant_deep_link"],
  image: ["aw_image_url", "merchant_image_url", "merchant_thumb_url", "aw_thumb_url"],
  category: ["category_name"],
};

function firstNonEmpty(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    if (row[k] && row[k].trim() !== "") return row[k];
  }
  return "";
}

async function main() {
  console.log(`AWIN account + catalog audit — publisher ${PUBLISHER_ID}`);
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log("Read-only. No site data touched, nothing committed, nothing pushed.");

  // --- Programme relationships ---
  printSection("JOINED PROGRAMMES");
  const joined = await fetchProgrammes("joined");
  if (joined.ok) {
    printProgrammeRows(joined.data);
    console.log(`\n  Total joined: ${joined.data.length}`);
  } else {
    console.log(`  Request failed (HTTP ${joined.status})`);
  }

  printSection("PENDING / NEW INVITATIONS");
  const pending = await fetchProgrammes("pending");
  if (pending.ok) {
    printProgrammeRows(pending.data);
    console.log(`\n  Total pending: ${pending.data.length}`);
  } else {
    console.log(`  Request failed (HTTP ${pending.status})`);
  }

  printSection("SUSPENDED OR REJECTED");
  for (const relationship of ["suspended", "rejected"]) {
    const result = await fetchProgrammes(relationship);
    if (result.ok) {
      console.log(`  ${relationship}:`);
      printProgrammeRows(result.data);
    } else {
      console.log(`  ${relationship}: request failed (HTTP ${result.status})`);
    }
  }

  // --- Full feed list ---
  printSection("DATAFEED LIST");
  let feedList: FeedListRow[] = [];
  try {
    feedList = await fetchFeedList();
    const joinedFeeds = feedList.filter((r) => r["Membership Status"] === "active");
    console.log(`  Total feeds visible: ${feedList.length}`);
    console.log(`  Feeds for joined/active advertisers: ${joinedFeeds.length}`);
    for (const r of joinedFeeds) {
      console.log(
        `  ${r["Advertiser Name"]}  [feed ${r["Feed ID"]}, ${r["Language"]}]` +
          `  ${r["No of products"]} products` +
          `  last imported ${r["Last Imported"] || "never"}`
      );
    }
  } catch (err) {
    console.log(`  ${(err as Error).message}`);
  }

  // --- Deep per-partner feed audit ---
  printSection("FEED AUDIT — CANVAS VOWS / KING KOIL / TSARBOMBA");
  for (const target of FEED_AUDIT_TARGETS) {
    console.log(`\n--- ${target.match} (partner-compliance id: "${target.partnerId}") ---`);

    const candidates = feedList.filter(
      (r) => r["Advertiser Name"] === target.match && r["Membership Status"] === "active"
    );
    if (candidates.length === 0) {
      console.log(`  No active feed found in the feed list for "${target.match}".`);
      continue;
    }
    if (candidates.length > 1) {
      console.log(
        `  ${candidates.length} feeds found for this advertiser — using the first English one, ` +
          `listing all candidates for visibility:`
      );
      for (const c of candidates) {
        console.log(
          `    feed ${c["Feed ID"]}  "${c["Feed Name"]}"  ${c["Language"]}  ${c["No of products"]} products` +
            (c["Vertical"] ? `  vertical=${c["Vertical"]}` : "")
        );
      }
    }
    const chosen =
      candidates.find((c) => c["Language"] === "English" && !c["Vertical"]) ??
      candidates.find((c) => c["Language"] === "English") ??
      candidates[0];
    console.log(`  Using feed ${chosen["Feed ID"]} ("${chosen["Feed Name"] || "Default"}")`);

    let rows: Record<string, string>[];
    try {
      rows = await downloadAndParseFeed(chosen.URL);
    } catch (err) {
      console.log(`  Download/parse failed: ${(err as Error).message}`);
      continue;
    }

    console.log(`  Product count: ${rows.length}`);

    // Category mapping — raw feed category -> Walmart-taxonomy department,
    // via the real lib/category-mapper.ts logic (not reimplemented here).
    const categoryCounts = new Map<string, number>();
    const deptCounts = new Map<string, number>();
    for (const row of rows) {
      const raw = row.category_name?.trim() || "(none)";
      categoryCounts.set(raw, (categoryCounts.get(raw) ?? 0) + 1);
      const mapping = mapProductToCategory({
        title: row.product_name || "",
        description: row.description || row.product_short_description || "",
        brand: row.brand_name || "",
        partnerCategory: row.category_name || row.merchant_category || undefined,
        price: Number(row.search_price) || 0,
        url: row.aw_deep_link || row.merchant_deep_link || "",
        partnerId: target.partnerId,
      });
      deptCounts.set(mapping.department, (deptCounts.get(mapping.department) ?? 0) + 1);
    }
    console.log(`  Raw categories (${categoryCounts.size}):`);
    for (const [cat, count] of [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${cat}: ${count}`);
    }
    console.log(`  Would map to departments:`);
    for (const [dept, count] of [...deptCounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${dept}: ${count}`);
    }

    // Missing/broken field check
    const missing: Record<string, number> = { name: 0, price: 0, deepLink: 0, image: 0, category: 0 };
    const examples: Record<string, string[]> = { name: [], price: [], deepLink: [], image: [], category: [] };
    for (const row of rows) {
      for (const [field, keys] of Object.entries(REQUIRED_FIELD_CANDIDATES)) {
        const value = firstNonEmpty(row, keys);
        const isBadPrice = field === "price" && (!value || Number.isNaN(Number(value)) || Number(value) <= 0);
        if ((!value && field !== "price") || isBadPrice) {
          missing[field]++;
          if (examples[field].length < 3) {
            examples[field].push(row.product_name || row.merchant_product_id || "(no name)");
          }
        }
      }
    }
    console.log(`  Missing/broken fields:`);
    let anyMissing = false;
    for (const [field, count] of Object.entries(missing)) {
      if (count > 0) {
        anyMissing = true;
        console.log(`    ${field}: ${count} of ${rows.length} rows — e.g. ${examples[field].join("; ")}`);
      }
    }
    if (!anyMissing) console.log(`    none — every row has name, price, deep link, image, and category`);

    // Compliance gate — real function from lib/partner-compliance.ts,
    // reflecting whatever is currently in the working tree (including
    // any uncommitted changes to that file).
    const gate = checkImportGate(target.partnerId);
    console.log(
      `  Compliance gate: ${gate.allowed ? "ALLOWED" : "BLOCKED"}` +
        (!gate.allowed ? ` — ${gate.reason}` : "")
    );
  }

  // --- Payment status ---
  printSection("PAYMENT STATUS");
  const accounts = await fetchAccounts();
  if (accounts.ok) {
    console.log("  /accounts response (no documented payment-status field, showing raw result):");
    console.log(JSON.stringify(accounts.data, null, 2));
  } else {
    console.log(`  Request failed (HTTP ${accounts.status})`);
  }
  console.log(
    "\n  Note: no AWIN Publisher API endpoint for payment/invoice status was found in the " +
      "official docs. Check the AWIN dashboard directly (Account → Payments) for that."
  );

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("Report failed:", err);
  process.exit(1);
});
