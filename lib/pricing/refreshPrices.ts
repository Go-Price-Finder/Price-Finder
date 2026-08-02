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
 * row to an existing static product primarily by the AWIN merchant
 * product id embedded in its deep link (extractAwinProductId below),
 * falling back to normalized product name only when an id isn't
 * available, and upsert any price that's changed into
 * public.current_prices. It never touches the static
 * lib/<partner>-data.ts files, never adds or removes products — only
 * price/originalPrice can move, and only for products that already exist
 * in the static catalog. A feed row that can't be matched to an existing
 * product is skipped and counted, not guessed at.
 *
 * REQUIRES (Vercel env vars, same names scripts/awin-status-report.ts
 * already uses locally): AWIN_API_TOKEN is NOT required here (only the
 * feed-list CSV is used, which is a separate, unauthenticated-by-token
 * URL per that script's own header comment) — AWIN_FEED_LIST_URL is the
 * one that matters. If it's missing, this throws immediately with a clear
 * message rather than silently doing nothing, so a misconfigured cron
 * shows up as a loud failure in Vercel's logs, not silent staleness.
 *
 * CORRECTNESS HISTORY (important — read before trusting old data):
 * the first live run (2026-08-02) matched purely by normalized product
 * name. That looked successful (canvas-vows 204/204, king-koil 29/29
 * "matched") but was actually a serious data-correctness bug: many
 * genuinely distinct SKUs (different color/size variants, different
 * real prices) share an identical product name — e.g. king-koil's 29
 * real products collapse to only ~6 distinct names. Name-based matching
 * silently collapsed all of them onto one arbitrary price per name.
 * King Koil ended up with only 1 of 29 products getting any price at
 * all (and it was an arbitrary one, not necessarily even the right
 * product's price); canvas-vows wrote correct-looking-but-wrong prices
 * for the large majority of its catalog (only 42 of 204 upserted
 * correctly by chance). The bad rows already written to production were
 * deleted (`delete from current_prices where retailer in
 * ('canvas-vows','king-koil')`) before this fix shipped. tsar-bomba was
 * unaffected by this specific bug (zero name collisions there) but had
 * its own separate problem — only 26/189 rows matched at all, worth
 * revisiting now that id-based matching is in place.
 *
 * THE FIX: match by the AWIN merchant product id (the `p=` parameter in
 * the standard `pclick.php?p=<id>&a=<affid>&m=<merchantId>` deep-link
 * format) instead of name wherever possible — that id is unique per SKU.
 * Name matching remains only as a fallback for products/rows where an id
 * can't be extracted. See matchedById / matchedByName /
 * duplicateKeyCollisions on PartnerRefreshResult to see, per partner, how
 * much of its match set is reliable (id) vs. degraded (name) — and
 * re-verify live after any change to this file before trusting the next
 * scheduled run's output.
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

/** Every static product's deepLink (checked across canvas-vows, king-koil,
 * and tsar-bomba's data files) is an AWIN "pclick" tracking URL shaped
 * like `https://www.awin1.com/pclick.php?p=<merchantProductId>&a=<affid>
 * &m=<merchantId>` — and that `p=` value is unique per SKU even when many
 * SKUs share an identical product name (color/size variants, etc. — see
 * king-koil's 29 real products that collapse to just ~6 distinct names).
 * The live AWIN feed's own deep-link column is generated from the same
 * underlying product data, so it carries the same `p=` id for the same
 * SKU — making it a far more reliable match key than product name. Falls
 * back to null (caller falls back to name-matching) if the URL doesn't
 * match this shape, so a partner whose links use a different AWIN link
 * type (e.g. `cread.php`, seen in scripts/import-partner.mjs's own
 * wrapping logic for partners whose source CSV gave a bare merchant URL)
 * degrades gracefully instead of every product silently going unmatched. */
function extractAwinProductId(deepLink: string): string | null {
  const match = deepLink.match(/[?&]p=(\d+)/);
  return match ? match[1] : null;
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
   * duplicate-key collisions (see duplicateKeyCollisions below) — this is
   * the number of rows actually sent to Supabase, which can be lower than
   * `matched` if two feed rows still land on the same match key. */
  upserted: number;
  /** How many matched rows were matched by the AWIN merchant product ID
   * extracted from the deep link (reliable — unique per SKU) vs. by
   * normalized product name (unreliable — collapses color/size variants
   * that share a name). A partner with a high matchedByName share relative
   * to matchedById means its deep links aren't in the expected pclick.php
   * format and its data is less trustworthy than the match count alone
   * suggests. */
  matchedById: number;
  matchedByName: number;
  /** Count of feed rows that matched a key (id or name) already claimed by
   * an earlier row in this same run. With id-based matching this should
   * normally be 0 — every SKU has a distinct id. A nonzero count here
   * means either a genuine duplicate row in the feed, or (for rows that
   * fell back to name-matching) two different SKUs sharing one name, same
   * failure mode this replaced name-only matching to fix. Only the last
   * colliding row wins the upsert; the rest are dropped rather than sent
   * to Supabase (which would otherwise fail the whole batch with
   * Postgres's "ON CONFLICT DO UPDATE command cannot affect row a second
   * time"). */
  duplicateKeyCollisions: number;
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
        matchedById: 0,
        matchedByName: 0,
        duplicateKeyCollisions: 0,
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
        matchedById: 0,
        matchedByName: 0,
        duplicateKeyCollisions: 0,
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
      matchedById: 0,
      matchedByName: 0,
      duplicateKeyCollisions: 0,
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

    // Primary match key: the AWIN merchant product id embedded in each
    // static product's deepLink (see extractAwinProductId above) — unique
    // per SKU. Products whose deepLink doesn't carry a `p=` id (unexpected
    // link format) are simply absent from byId and fall back to name
    // matching below for that one product.
    const byId = new Map<string, (typeof partnerProducts)[number]>();
    for (const p of partnerProducts) {
      const id = extractAwinProductId(p.deepLink);
      if (id) byId.set(id, p);
    }
    // Fallback match key: normalized product name — kept only for products
    // that couldn't be keyed by id, or feed rows that don't carry a usable
    // deep-link column. Unreliable when multiple SKUs share a name (see
    // file header), so matches via this path are counted separately
    // (matchedByName) rather than silently mixed in with id matches.
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
      const feedDeepLink = row["aw_deep_link"] || row["merchant_deep_link"] || "";
      const feedProductId = feedDeepLink ? extractAwinProductId(feedDeepLink) : null;

      let staticProduct = feedProductId ? byId.get(feedProductId) : undefined;
      let matchedVia: "id" | "name" | null = staticProduct ? "id" : null;

      if (!staticProduct) {
        staticProduct = byName.get(normalizeName(feedName));
        if (staticProduct) matchedVia = "name";
      }

      if (!staticProduct) {
        result.unmatched++;
        if (result.unmatchedExamples.length < 5) result.unmatchedExamples.push(feedName || "(no name)");
        continue;
      }
      result.matched++;
      if (matchedVia === "id") result.matchedById++;
      else result.matchedByName++;

      const price = parseFeedPrice(row["search_price"]);
      if (price == null) {
        result.errors.push(`"${feedName}": feed price missing/invalid, skipped`);
        continue;
      }
      const rrp = parseFeedPrice(row["rrp_price"]);
      const originalPrice = rrp != null && rrp > price ? rrp : null;

      if (price !== staticProduct.price) result.priceChanges++;

      // Keyed by product_id (retailer is constant within this partner's
      // batch) so that if a second feed row lands on the same static
      // product — a genuine duplicate feed row, or (only possible via the
      // name-matching fallback) two different SKUs sharing one name — it
      // overwrites the first entry in this Map instead of becoming a
      // second row with the same (product_id, retailer) key in the
      // upsert payload. Supabase/Postgres rejects a single upsert
      // statement that would affect the same conflict-target row twice
      // ("ON CONFLICT DO UPDATE command cannot affect row a second time"),
      // so without this dedup step, one collision anywhere in the feed
      // fails the ENTIRE partner's upsert. "Last row wins" is an
      // arbitrary tiebreak, not a correctness guarantee — see
      // duplicateKeyCollisions on the result.
      if (upsertByProductId.has(staticProduct.id)) result.duplicateKeyCollisions++;
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
