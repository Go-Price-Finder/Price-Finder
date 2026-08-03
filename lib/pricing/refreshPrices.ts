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
 * ADVERTISER-NAME VERIFICATION HISTORY (2026-08-03): all six partners'
 * AWIN "Advertiser Name" guesses have now been independently confirmed
 * live via scripts/awin-status-report.ts's JOINED PROGRAMMES + DATAFEED
 * LIST output (run from the user's own shell — that script authenticates
 * with AWIN_API_TOKEN, a credential this session never touches directly).
 * canvas-vows/king-koil/tsar-bomba were confirmed 2026-08-02;
 * evdance/golden-maple/brooklyn-delhi were confirmed 2026-08-03. All six
 * names below are exact matches to AWIN's own "Advertiser Name" field —
 * see the per-partner notes on each entry for feed-availability caveats
 * that are independent of the name being correct. After any future
 * change to this file, call it once manually (see
 * app/api/cron/refresh-prices/route.ts) and read the per-partner
 * matched/unmatched counts in the response before trusting the next
 * scheduled run.
 */

type PartnerAwinMapping = {
  partnerId: string;
  advertiserName: string;
  verified: boolean;
  /** Optional explicit AWIN "Feed ID" to prefer when an advertiser has
   * more than one feed that would otherwise tie under the
   * English/no-Vertical selection rule below (see chooseFeed). Without
   * this, a tie is broken by feed-list row order, which is incidental
   * CSV ordering from AWIN's API, not something this code actually
   * controls — safe today, but silently fragile if AWIN ever reorders
   * that list. Set this whenever a live audit finds more than one
   * qualifying feed for the same advertiser. */
  pinnedFeedId?: string;
  /** Overrides the generic "name is unverified" skip message below when
   * verified: false for a reason OTHER than an unconfirmed name (e.g. the
   * name is confirmed correct but AWIN has no feed for this advertiser
   * yet — see brooklyn-delhi). Without this, a partner that's actually
   * name-confirmed-but-feed-blocked would misleadingly print "name is
   * unverified," which live-tested 2026-08-03 as a real, confusing
   * mismatch against this file's own header comment / PARTNER_AWIN_NAMES
   * documentation for that same partner. */
  skipReason?: string;
};

const PARTNER_AWIN_NAMES: PartnerAwinMapping[] = [
  // Confirmed via scripts/awin-status-report.ts's FEED_AUDIT_TARGETS.
  { partnerId: "canvas-vows", advertiserName: "Canvas Vows", verified: true },
  { partnerId: "king-koil", advertiserName: "King Koil", verified: true },
  { partnerId: "tsar-bomba", advertiserName: "Tsarbomba", verified: true },
  // Name confirmed live 2026-08-03 (scripts/awin-status-report.ts JOINED
  // PROGRAMMES). Membership is Active and AWIN has no datafeed for this
  // advertiser at all today (0 of 21 active feeds in the DATAFEED LIST
  // belong to it) — this is an AWIN account-side gap, not a naming
  // problem. Left as verified: false (would be a harmless no-op — zero
  // feed rows — if flipped, but flip it once a feed appears) rather than
  // true, so a future reader doesn't assume "verified: false" here still
  // means "name unconfirmed."
  {
    partnerId: "brooklyn-delhi",
    advertiserName: "Brooklyn Delhi",
    verified: false,
    skipReason:
      `AWIN advertiser name "Brooklyn Delhi" is confirmed correct (verified live 2026-08-03) ` +
      `and membership is Active — this partner is skipped because AWIN currently has no ` +
      `datafeed for it at all (0 of 21 active feeds), not because of a naming problem. ` +
      `Re-run scripts/awin-status-report.ts periodically; flip verified: true once a feed appears.`,
  },
  // Name confirmed live 2026-08-03. Two active English feeds exist for
  // this advertiser (F1320, 81 products, freshest; and the older 108581,
  // 1 product, stale since 2026-05-15) — both would otherwise tie under
  // the English/no-Vertical rule, so pinnedFeedId removes the ambiguity
  // explicitly instead of relying on incidental feed-list row order.
  { partnerId: "evdance", advertiserName: "EVDANCE", verified: true, pinnedFeedId: "F1320" },
  // Name confirmed live 2026-08-03. Exactly one active feed (F2615, 352
  // products) — no ambiguity.
  { partnerId: "golden-maple", advertiserName: "Golden Maple", verified: true },
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

/** Root cause found live 2026-08-03 via priceDiagnostics: PRICE_COLUMNS was
 * never wrong - both evdance's and golden-maple's feeds use the plain
 * "price" column (already the 3rd candidate). The real bug is that these
 * feeds' price values aren't bare numbers, they're currency-suffixed
 * strings like "199.95 USD" - and Number("199.95 USD") is NaN, so every
 * row silently failed here regardless of which column name was tried.
 * scripts/import-partner.mjs's own parsePrice() already strips everything
 * but digits and ".", the same fix applied here for parity. */
function parseFeedPrice(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const value = parseFloat(cleaned);
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
  /** TEMPORARY DIAGNOSTIC (added 2026-08-02, safe to remove once
   * matchedByName settles near 0 for every partner): for up to 3 feed rows
   * that fell back to name-matching, records which of the deep-link column
   * names this file checks (aw_deep_link / merchant_deep_link / deep_link)
   * were actually present and non-empty on that row, plus the id this file
   * extracted from each (or null). Exists to answer "is the column name
   * wrong, or is the id itself just different from the static catalog's,"
   * without ever needing to look at the feed CSV directly. No secrets or
   * full URLs beyond the deep link itself (which is not sensitive — it's
   * the same link type shown publicly on product pages). */
  nameFallbackDiagnostics: {
    productName: string;
    columnsPresent: Record<string, string>;
    extractedIds: Record<string, string | null>;
  }[];
  /** Up to 5 examples of feed rows that carried a real, successfully
   * extracted merchant product id that simply isn't in this partner's
   * static catalog — meaning the live feed has a SKU (new, or renumbered
   * upstream) that our one-time import doesn't know about. These are
   * intentionally left unmatched rather than guessed at via name-matching
   * (see the comment at the matching loop). A nonzero count here most
   * likely means it's time to re-run scripts/import-partner.mjs for this
   * partner to refresh the static catalog — not a bug in this file. */
  idNotInCatalogExamples: string[];
  /** TEMPORARY DIAGNOSTIC (added 2026-08-03): for up to 3 matched rows that
   * failed price extraction even after widening PRICE_COLUMNS to
   * import-partner.mjs's full candidate list, this dumps every column name
   * and value actually present on that raw feed row — so the real price
   * column's literal header name can be read directly from the live
   * response instead of guessing at more candidates blind. Remove once
   * evdance/golden-maple upsert successfully. */
  priceDiagnostics: { productName: string; row: Record<string, string> }[];
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
        nameFallbackDiagnostics: [],
        idNotInCatalogExamples: [],
        priceDiagnostics: [],
      });
      continue;
    }

    if (!mapping.verified) {
      partnerResults.push({
        partnerId: mapping.partnerId,
        skipped:
          mapping.skipReason ??
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
        nameFallbackDiagnostics: [],
        idNotInCatalogExamples: [],
        priceDiagnostics: [],
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
      nameFallbackDiagnostics: [],
      idNotInCatalogExamples: [],
      priceDiagnostics: [],
    };

    const candidates = feedList.filter(
      (r) =>
        r["Advertiser Name"] === mapping.advertiserName &&
        r["Membership Status"] === "active"
    );
    // A pinned feed id takes priority whenever set (see PartnerAwinMapping's
    // pinnedFeedId comment) — falls through to the English/no-Vertical
    // heuristic if the pin doesn't match anything currently in the feed
    // list (e.g. AWIN retired/renamed that feed id), so a stale pin
    // degrades to the old best-effort behavior instead of hard-failing.
    const pinned = mapping.pinnedFeedId
      ? candidates.find((c) => c["Feed ID"] === mapping.pinnedFeedId)
      : undefined;
    const chosen =
      pinned ??
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

    if (mapping.pinnedFeedId && !pinned) {
      result.errors.push(
        `Pinned feed id "${mapping.pinnedFeedId}" for "${mapping.advertiserName}" not found in ` +
          `today's feed list — fell back to "${chosen["Feed ID"]}" (${chosen["Language"]}). ` +
          `Re-verify with scripts/awin-status-report.ts and update pinnedFeedId.`
      );
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

    // Candidate deep-link column names, in priority order — a union of
    // what scripts/awin-status-report.ts checks (aw_deep_link,
    // merchant_deep_link) and what scripts/import-partner.mjs's own
    // default mapping checks when a partner's static catalog was first
    // built (deep_link, merchant_deep_link, affiliate_url, product_url,
    // url) — the two scripts were written independently and didn't agree
    // on one name, so a partner imported via one of the mjs-only
    // candidates (e.g. plain "deep_link") would silently fail every
    // id-match here without this union.
    const DEEP_LINK_COLUMNS = [
      "aw_deep_link",
      "deep_link",
      "merchant_deep_link",
      "affiliate_url",
      "product_url",
      "url",
    ];

    // Same class of bug as DEEP_LINK_COLUMNS above, found live 2026-08-03:
    // this file hardcoded row["product_name"] as the only name column,
    // but scripts/import-partner.mjs (which built every static catalog,
    // including evdance's and golden-maple's) has always resolved the
    // name column from a candidate list — "product_name", "name",
    // "title", or "product name" — because different AWIN feed templates
    // use different headers for the same field. evdance and golden-maple
    // both ship deep links in the cread.php?...&ued=<url> shape (no
    // embedded merchant product id at all, unlike canvas-vows/king-koil/
    // tsar-bomba's pclick.php?p=<id> shape), so every one of their rows
    // was ALWAYS going to depend on the name-matching fallback — and that
    // fallback was silently reading an empty string for every row because
    // their real feed's name column isn't literally "product_name". Live
    // verification showed 0/81 and 0/352 matched with feedName === "" for
    // every row before this fix. Widened to the same candidate list
    // import-partner.mjs uses, first non-empty column wins.
    const NAME_COLUMNS = ["product_name", "name", "title", "product name"];

    // Same bug class again, found live 2026-08-03 immediately after the
    // NAME_COLUMNS fix: with matching now working (64/81 evdance,
    // 346/352 golden-maple via name), every matched row failed at the
    // price step with "feed price missing/invalid, skipped". This file
    // hardcoded row["search_price"] as the only price column, but
    // scripts/import-partner.mjs resolves price from a candidate list —
    // "search_price", "sale_price", "price", "current_price" — for the
    // same reason as NAME_COLUMNS: different AWIN feed templates use
    // different headers. evdance/golden-maple's feeds evidently don't use
    // literally "search_price". Widened to the same candidate list,
    // first non-empty column wins. rrp/original-price gets the same
    // treatment since scripts/import-partner.mjs also treats it as a
    // fallback-style field ("rrp_price" then "rrp").
    // Full parity fix (local Claude Code review, 2026-08-03): the first
    // pass of this fix only ported 2 of import-partner.mjs's 5 rrp/
    // original-price candidates. Widened to match its originalPrice:
    // list exactly, not just a subset.
    const PRICE_COLUMNS = ["search_price", "sale_price", "price", "current_price"];
    const RRP_COLUMNS = ["rrp_price", "rrp", "list_price", "original_price", "was_price"];

    function firstNonEmpty(row: Record<string, string>, columns: string[]): string | undefined {
      for (const col of columns) {
        const value = row[col];
        if (value) return value;
      }
      return undefined;
    }

    for (const row of rows) {
      let feedName = "";
      for (const col of NAME_COLUMNS) {
        const value = row[col];
        if (value) {
          feedName = value;
          break;
        }
      }

      let feedProductId: string | null = null;
      for (const col of DEEP_LINK_COLUMNS) {
        const value = row[col];
        if (value) {
          const id = extractAwinProductId(value);
          if (id) {
            feedProductId = id;
            break;
          }
        }
      }

      let staticProduct = feedProductId ? byId.get(feedProductId) : undefined;
      let matchedVia: "id" | "name" | null = staticProduct ? "id" : null;

      // IMPORTANT: only fall back to name-matching when the feed row itself
      // carried no usable id at all (feedProductId === null — a genuine
      // feed-format problem). If an id WAS extracted but simply isn't in
      // byId, that does NOT mean "try the name instead" — it means this
      // feed row refers to a SKU that doesn't exist in our static catalog
      // (new since the one-time import, or since renumbered upstream).
      // Falling back to name-matching in that case reintroduces the exact
      // bug this file was rewritten to fix: silently attaching this row's
      // price to a DIFFERENT, unrelated product that happens to share a
      // name. Live verification against king-koil confirmed this is a
      // real, current scenario (not hypothetical) — several feed rows had
      // a perfectly valid, successfully-extracted aw_deep_link id that
      // simply wasn't present in the catalog snapshot. Those rows are
      // correctly left unmatched below, not guessed at.
      if (!staticProduct && feedProductId === null) {
        staticProduct = byName.get(normalizeName(feedName));
        if (staticProduct) matchedVia = "name";
      }

      if (feedProductId === null && result.nameFallbackDiagnostics.length < 3) {
        const columnsPresent: Record<string, string> = {};
        const extractedIds: Record<string, string | null> = {};
        for (const col of DEEP_LINK_COLUMNS) {
          const value = row[col];
          if (value) {
            columnsPresent[col] = value;
            extractedIds[col] = extractAwinProductId(value);
          }
        }
        result.nameFallbackDiagnostics.push({ productName: feedName, columnsPresent, extractedIds });
      }

      if (feedProductId !== null && !staticProduct && result.idNotInCatalogExamples.length < 5) {
        result.idNotInCatalogExamples.push(`"${feedName}" (feed id ${feedProductId})`);
      }

      if (!staticProduct) {
        result.unmatched++;
        if (result.unmatchedExamples.length < 5) result.unmatchedExamples.push(feedName || "(no name)");
        continue;
      }
      result.matched++;
      if (matchedVia === "id") result.matchedById++;
      else result.matchedByName++;

      const price = parseFeedPrice(firstNonEmpty(row, PRICE_COLUMNS));
      if (price == null) {
        result.errors.push(`"${feedName}": feed price missing/invalid, skipped`);
        if (result.priceDiagnostics.length < 3) {
          result.priceDiagnostics.push({ productName: feedName, row });
        }
        continue;
      }
      const rrp = parseFeedPrice(firstNonEmpty(row, RRP_COLUMNS));
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
