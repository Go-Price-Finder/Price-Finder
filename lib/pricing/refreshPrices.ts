import { gunzipSync } from "node:zlib";
import Papa from "papaparse";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllRealProducts } from "@/lib/partners";
import complianceRegistry from "@/lib/partner-compliance.json";
import type { WishlistRetailerId } from "@/lib/types";

/**
 * The AWIN feed-ingestion half of the daily price-refresh pipeline
 * (Section 6.1 of the strategic growth plan) — this is the piece
 * lib/pricing/snapshotPrices.ts and lib/alerts/checkPriceDrops.ts were
 * already built to consume (via public.current_prices,
 * see lib/pricing/getEffectivePrice.ts) but that nothing populated yet.
 * This is that "nothing."
 *
 * WHAT THIS ACTUALLY DOES: for each active real partner below, download
 * that partner's live AWIN datafeed (same feed/format
 * scripts/awin-status-report.ts already reads read-only), match each feed
 * row to an existing static product by normalized name, and upsert any
 * price that's changed into public.current_prices. It never touches the
 * static lib/<partner>-data.ts files, never adds or removes products —
 * only price/originalPrice can move, and only for products that already
 * exist in the static catalog. A feed row that can't be matched to an
 * existing product is skipped and counted, not guessed at.
 *
 * REQUIRES (Vercel env vars, same names scripts/awin-status-report.ts
 * already uses locally): AWIN_API_TOKEN is NOT required here (only the
 * feed-list CSV is used, which is a separate, unauthenticated-by-token
 * URL per that script's own header comment) — AWIN_FEED_LIST_URL is the
 * one that matters. If it's missing, this throws immediately with a clear
 * message rather than silently doing nothing, so a misconfigured cron
 * shows up as a loud failure in Vercel's logs, not silent staleness.
 *
 * HONESTLY UNVERIFIED (2026-08-02): this has never been run against a
 * real AWIN feed — this sandbox has no AWIN credentials, and even if it
 * did, per scripts/import-partner.mjs's own note, arbitrary vendor CDN/
 * feed URLs aren't reachable from this cloud sandbox. The advertiser-name
 * mapping below is only independently confirmed for the three partners
 * scripts/awin-status-report.ts already audited (canvas-vows, king-koil,
 * tsar-bomba); the other three are the partner's own display name as a
 * best guess, marked verified: false, and are SKIPPED by default until
 * someone confirms the real AWIN "Advertiser Name" for each (check the
 * AWIN publisher dashboard, or run scripts/awin-status-report.ts with
 * those three added to its FEED_AUDIT_TARGETS) — better to cover half the
 * partners correctly than silently mis-map a feed to the wrong partner
 * and write wrong prices. Before trusting this to run unattended daily,
 * call it once manually (see app/api/cron/refresh-prices/route.ts) and
 * read the per-partner matched/unmatched counts in the response.
 */

type PartnerAwinMapping = {
  partnerId: string;
  advertiserName: string;
  verified: boolean;
};

const PARTNER_AWIN_NAMES: PartnerAwinMapping[] = [
  // Confirmed via scripts/awin-status-report.ts's FEED_AUDIT_TARGETS.
  { partnerId: "canvas-vows", advertiserName: "Canvas Vows", verified: true },
  { partnerId: "king-koil", advertiserName: "King Koil", verified: true },
  { partnerId: "tsar-bomba", advertiserName: "Tsarbomba", verified: true },
  // NOT independently confirmed — best guess from the partner's own display
  // name. Skipped until verified: true. See file header comment.
  { partnerId: "brooklyn-delhi", advertiserName: "Brooklyn Delhi", verified: false },
  { partnerId: "evdance", advertiserName: "EVDANCE", verified: false },
  { partnerId: "golden-maple", advertiserName: "Golden Maple", verified: false },
];

type FeedListRow = {
  "Advertiser Name": string;
  "Membership Status": string;
  Language: string;
  Vertical: string;
  "Feed ID": string;
  "Feed Name": string;
  URL: string;
};

async function fetchFeedList(feedListUrl: string): Promise<FeedListRow[]> {
  const res = await fetch(feedListUrl);
  if (!res.ok) throw new Error(`AWIN feed list fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  const parsed = Papa.parse<FeedListRow>(text, { header: true, skipEmptyLines: true });
  return parsed.data;
}

async function downloadAndParseFeed(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`AWIN feed download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Feed URLs are gzip-compressed CSV, same as scripts/awin-status-report.ts.
  const csv = gunzipSync(buf).toString("utf8");
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  return parsed.data;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseFeedPrice(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export type PartnerRefreshResult = {
  partnerId: string;
  skipped?: string; // reason, if this partner was skipped entirely
  feedRows: number;
  matched: number;
  unmatched: number;
  unmatchedExamples: string[];
  priceChanges: number;
  upserted: number;
  errors: string[];
};

export type RefreshPricesResult = {
  partners: PartnerRefreshResult[];
};

export async function refreshPrices(): Promise<RefreshPricesResult> {
  const feedListUrl = process.env.AWIN_FEED_LIST_URL;
  if (!feedListUrl) {
    throw new Error(
      "AWIN_FEED_LIST_URL is not set — refresh-prices cannot run without it. Set it as a Vercel " +
        "project env var (same value used locally for scripts/awin-status-report.ts) before this " +
        "cron can do anything."
    );
  }

  const feedList = await fetchFeedList(feedListUrl);
  const activeStaticProducts = getAllRealProducts();
  const supabase = createAdminClient();

  const partnerResults: PartnerRefreshResult[] = [];

  for (const mapping of PARTNER_AWIN_NAMES) {
    const complianceEntry = (
      complianceRegistry as { partners: Record<string, { status?: string }> }
    ).partners[mapping.partnerId];

    if (complianceEntry?.status !== "active") {
      partnerResults.push({
        partnerId: mapping.partnerId,
        skipped: `compliance status is "${complianceEntry?.status ?? "missing"}", not "active"`,
        feedRows: 0,
        matched: 0,
        unmatched: 0,
        unmatchedExamples: [],
        priceChanges: 0,
        upserted: 0,
        errors: [],
      });
      continue;
    }

    if (!mapping.verified) {
      partnerResults.push({
        partnerId: mapping.partnerId,
        skipped:
          `AWIN advertiser name "${mapping.advertiserName}" is unverified — confirm the exact name ` +
          `in the AWIN publisher dashboard and set verified: true in lib/pricing/refreshPrices.ts ` +
          `before this partner is included.`,
        feedRows: 0,
        matched: 0,
        unmatched: 0,
        unmatchedExamples: [],
        priceChanges: 0,
        upserted: 0,
        errors: [],
      });
      continue;
    }

    const result: PartnerRefreshResult = {
      partnerId: mapping.partnerId,
      feedRows: 0,
      matched: 0,
      unmatched: 0,
      unmatchedExamples: [],
      priceChanges: 0,
      upserted: 0,
      errors: [],
    };

    const candidates = feedList.filter(
      (r) =>
        r["Advertiser Name"] === mapping.advertiserName &&
        r["Membership Status"] === "active"
    );
    const chosen =
      candidates.find((c) => c["Language"] === "English" && !c["Vertical"]) ??
      candidates.find((c) => c["Language"] === "English") ??
      candidates[0];

    if (!chosen) {
      result.errors.push(
        `No active AWIN feed found for advertiser "${mapping.advertiserName}" in the feed list.`
      );
      partnerResults.push(result);
      continue;
    }

    let rows: Record<string, string>[];
    try {
      rows = await downloadAndParseFeed(chosen.URL);
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
      partnerResults.push(result);
      continue;
    }
    result.feedRows = rows.length;

    const partnerProducts = activeStaticProducts.filter((p) => p.partnerId === mapping.partnerId);
    const byName = new Map(partnerProducts.map((p) => [normalizeName(p.name), p]));

    const upsertBatch: {
      product_id: string;
      retailer: WishlistRetailerId;
      price: number;
      original_price: number | null;
    }[] = [];

    for (const row of rows) {
      const feedName = row["product_name"] || "";
      const staticProduct = byName.get(normalizeName(feedName));
      if (!staticProduct) {
        result.unmatched++;
        if (result.unmatchedExamples.length < 5) result.unmatchedExamples.push(feedName || "(no name)");
        continue;
      }
      result.matched++;

      const price = parseFeedPrice(row["search_price"]);
      if (price == null) {
        result.errors.push(`"${feedName}": feed price missing/invalid, skipped`);
        continue;
      }
      const rrp = parseFeedPrice(row["rrp_price"]);
      const originalPrice = rrp != null && rrp > price ? rrp : null;

      if (price !== staticProduct.price) result.priceChanges++;

      upsertBatch.push({
        product_id: staticProduct.id,
        retailer: mapping.partnerId as WishlistRetailerId,
        price,
        original_price: originalPrice,
      });
    }

    if (upsertBatch.length > 0) {
      const { error } = await supabase
        .from("current_prices")
        .upsert(upsertBatch, { onConflict: "product_id,retailer" });
      if (error) {
        result.errors.push(`Upsert failed: ${error.message}`);
      } else {
        result.upserted = upsertBatch.length;
      }
    }

    partnerResults.push(result);
  }

  return { partners: partnerResults };
}
