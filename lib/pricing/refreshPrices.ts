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
 * VERIFIED LIVE (2026-08-02): manually triggered once in production
 * against real AWIN feeds after the required env vars were set. Results:
 * canvas-vows matched 204/204 feed rows and king-koil matched 29/29 —
 * both fully correct name matches (both initially wrote zero prices due
 * to a duplicate-name upsert bug, now fixed; see duplicateNameCollisions
 * above). tsar-bomba matched only 26/189 (86% unmatched) — its feed's
 * product names apparently don't line up well against the static
 * catalog's names for most SKUs; that partner's coverage is real but
 * incomplete, not broken, and is worth investigating further (a better
 * match key than raw product name, e.g. a SKU/model-number field, would
 * likely help) before relying on its prices being comprehensive.
 *
 * The advertiser-name mapping below is only independently confirmed for
 * the three partners scripts/awin-status-report.ts already audited
 * (canvas-vows, king-koil, tsar-bomba); the other three are the
 * partner's own display name as a best guess, marked verified: false,
 * and are SKIPPED by default until someone confirms the real AWIN
 * "Advertiser Name" for each (check the AWIN publisher dashboard, or run
 * scripts/awin-status-report.ts with those three added to its
 * FEED_AUDIT_TARGETS) — better to cover half the partners correctly than
 * silently mis-map a feed to the wrong partner and write wrong prices.
 * After any future change to this file, call it once manually (see
 * app/api/cron/refresh-prices/route.ts) and read the per-partner
 * matched/unmatched counts in the response before trusting the next
 * scheduled run.
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
  /** Distinct static products with a matched feed row, after collapsing
   * duplicate-name collisions (see duplicateNameCollisions below) — this
   * is the number of rows actually sent to Supabase, which can be lower
   * than `matched` when multiple feed rows normalize to the same product
   * name. */
  upserted: number;
  /** Count of feed rows that matched a product name already claimed by an
   * earlier row in this same run (e.g. two SKU variants sharing an
   * identical product_name after normalization). These rows are real
   * `matched` hits — they're just not distinguishable by name alone, so
   * only the last one wins the upsert; the rest are dropped rather than
   * sent to Supabase (which would otherwise fail the whole batch with
   * Postgres's "ON CONFLICT DO UPDATE command cannot affect row a second
   * time"). A nonzero count here means this partner's name-matching
   * heuristic needs a better disambiguator (e.g. SKU/variant field) before
   * its prices can be trusted for every matched product, not just most of
   * them. */
  duplicateNameCollisions: number;
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
        duplicateNameCollisions: 0,
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
        duplicateNameCollisions: 0,
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
      duplicateNameCollisions: 0,
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

    const upsertByProductId = new Map<
      string,
      {
        product_id: string;
        retailer: WishlistRetailerId;
        price: number;
        original_price: number | null;
      }
    >();

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

      // Keyed by product_id (retailer is constant within this partner's
      // batch) so that if a second feed row normalizes to the same static
      // product — e.g. two SKU variants sharing an identical product_name
      // — it overwrites the first entry in this Map instead of becoming a
      // second row with the same (product_id, retailer) key in the
      // upsert payload. Supabase/Postgres rejects a single upsert
      // statement that would affect the same conflict-target row twice
      // ("ON CONFLICT DO UPDATE command cannot affect row a second time"),
      // so without this dedup step, one duplicated name anywhere in the
      // feed fails the ENTIRE partner's upsert — which is exactly what
      // happened the first time this ran against real AWIN feeds
      // (canvas-vows and king-koil both matched every row but wrote zero
      // prices because of this). "Last row wins" is an arbitrary
      // tiebreak, not a correctness guarantee — see
      // duplicateNameCollisions on the result.
      if (upsertByProductId.has(staticProduct.id)) result.duplicateNameCollisions++;
      upsertByProductId.set(staticProduct.id, {
        product_id: staticProduct.id,
        retailer: mapping.partnerId as WishlistRetailerId,
        price,
        original_price: originalPrice,
      });
    }

    const upsertBatch = [...upsertByProductId.values()];
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
