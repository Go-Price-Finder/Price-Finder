/**
 * "Price as of" dates for displayed (catalog) prices — PER-FEED model.
 *
 * ⚠️ DEBT — INTERIM IMPLEMENTATION, DELETED BY COWORK'S STEP 2. This
 * hand-maintained module (FEED_VINTAGE, PARTNER_DEFAULT_FEED, and
 * especially TSAR_BOMBA_DEFAULT_FEED_SLUGS) is superseded by the
 * feed_status table Cowork specced 2026-08-17 (per-feed rows, seven
 * total). It shipped anyway because a live 79-day freshness overclaim on
 * 26 pages outweighed mechanism purity — correct output today over a
 * better mechanism tomorrow. When Step 2 lands, this file's data moves to
 * feed_status and the label reads from there; do not extend this file.
 *
 * AS-OF IS A PROPERTY OF THE FEED, NOT THE PARTNER (operator decision,
 * 2026-08-17). A partner can draw from multiple feeds with different
 * vintages — tsar-bomba's catalog is 246 products from the US feed
 * (113495, current at the 2026-08-02 refresh) plus 26 from the Default
 * feed (105368, frozen at AWIN since 2026-05-15). The first version of
 * this file used one date per partner and labelled all 272 "Aug 2, 2026"
 * — a 79-day freshness overclaim on 26 live pages, the same offence
 * PriceHistoryChart was suppressed for. Per-feed is also the model the
 * future offers table needs, so this is not throwaway structure.
 *
 * THE DATE IS THE PRICE DATA'S VINTAGE: when the displayed number was
 * last current at its source. For a feed frozen upstream, that is the
 * freeze date regardless of when we imported it (canvas-vows: imported
 * Jul 29 from a feed serving a May-15 snapshot → May 15). For an import
 * from a then-current feed, it is the import/refresh date. It is NOT the
 * feed's own last-import timestamp today — displayed prices come from
 * catalog_products, refreshed only by explicit imports, so dating labels
 * off live feed metadata would overclaim wherever the feed outruns the
 * catalog (king-koil: feed imports daily, catalog verified 2026-08-02).
 * If live-price display ships (Option A — chosen, not shipped; findings
 * doc §6), the honest source becomes per-feed Last Imported and the
 * VINTAGE values here get replaced, but the per-feed SHAPE stays.
 *
 * Derivations (git history + AWIN feed metadata, 2026-08-17):
 * - awin:103552 (canvas-vows sole feed): frozen 2026-05-15; import
 *   4f6f302 (Jul 29) copied a May-15 snapshot. Census 2026-08-16: 93 of
 *   194 title-matched prices no longer match any live variant.
 * - awin:105368 (tsar-bomba Default feed): frozen 2026-05-15; the 87877a2
 *   refresh (Aug 2) merged its May-15 snapshot for the 26 products below.
 * - awin:113495 (tsar-bomba US feed): current at the 87877a2 refresh →
 *   2026-08-02.
 * - awin:101819 (king-koil): current at the 87877a2 refresh → 2026-08-02.
 * - awin:F1320 (evdance) / awin:F2615 (golden-maple): current at import
 *   14dc4cf → 2026-07-25.
 * - csv:brooklyn-delhi (no AWIN feed exists): import 8f1342a →
 *   2026-07-25.
 *
 * Hand-maintained. UPDATE THE AFFECTED FEED'S VINTAGE IN THE SAME COMMIT
 * as any catalog price refresh/re-import — a stale entry here recreates
 * the exact dishonesty this label exists to end. If a re-import changes
 * which feed a product came from, update TSAR_BOMBA_DEFAULT_FEED_SLUGS
 * (or its successor mapping) in the same commit.
 */

/** Price-data vintage per source feed (ISO date). */
const FEED_VINTAGE: Record<string, string> = {
  "awin:103552": "2026-05-15",
  "awin:105368": "2026-05-15",
  "awin:113495": "2026-08-02",
  "awin:101819": "2026-08-02",
  "awin:F1320": "2026-07-25",
  "awin:F2615": "2026-07-25",
  "csv:brooklyn-delhi": "2026-07-25",
};

/** Which feed a partner's products come from, unless overridden below. */
const PARTNER_DEFAULT_FEED: Record<string, string> = {
  "brooklyn-delhi": "csv:brooklyn-delhi",
  "canvas-vows": "awin:103552",
  evdance: "awin:F1320",
  "golden-maple": "awin:F2615",
  "king-koil": "awin:101819",
  "tsar-bomba": "awin:113495",
};

/**
 * The 26 tsar-bomba products sourced from the frozen Default feed
 * (105368) rather than the US feed. Derived 2026-08-17 by intersecting
 * feed 105368's pclick p= ids with the static catalog's — reproduces the
 * 87877a2 commit message's own "26 Default-only" count exactly. (The
 * scripts/_tsarbomba-mapping.json file is a CSV column mapping, not a
 * product→feed map — this set had to be derived from the feeds.)
 */
const TSAR_BOMBA_DEFAULT_FEED_SLUGS = new Set([
  "atomic-interchangeable-ceramic-edition-black",
  "elemental-series-automatic-watch-tb8207a-black",
  "elemental-series-automatic-watch-tb8207a-silver-blue",
  "elemental-series-automatic-watch-tb8209a-silver-blue",
  "elemental-series-automatic-watch-tb8209a-gold-black",
  "elemental-series-automatic-watch-tb8209a-silver-black",
  "elemental-series-automatic-watch-tb8210a-black",
  "elemental-series-automatic-watch-tb8210a-silver-black",
  "elemental-series-automatic-watch-tb8210a-black-orange",
  "elemental-series-automatic-watch-tb8212-carbon-fiber-yellow",
  "elemental-series-calendar-version-tb8204qa-light-blue",
  "elemental-series-calendar-version-tb8204qa-green",
  "elemental-series-carbon-fiber-automatic-watch-tb8207cf",
  "elemental-series-ceramic-automatic-watch-tb8209c-white",
  "elemental-series-cubic-zirconia-automatic-watch-tb8208d-red",
  "elemental-series-cubic-zirconia-automatic-watch-tb8208d-white",
  "elemental-series-cubic-zirconia-automatic-watch-tb8208d-black",
  "elemental-series-cubic-zirconia-automatic-watch-tb8209d-white",
  "elemental-series-cubic-zirconia-automatic-watch-tb8209d-golden-black",
  "elemental-series-cubic-zirconia-automatic-watch-tb8209d-black",
  "elemental-series-cubic-zirconia-automatic-watch-tb8209d-red",
  "elemental-series-titanium-edition-tb8208t-black",
  "elemental-series-titanium-edition-tb8208t-white",
  "elemental-series-titanium-edition-tb8208t-blue",
  "atomic-interchangeable-automatic-watch-zirconia-diamond-venus",
  "atomic-interchangeable-calendar-watch-zirconia-diamond-venus",
]);

/** Resolve the source feed for a product. */
function getSourceFeed(partnerId: string, slug: string): string | null {
  if (partnerId === "tsar-bomba" && TSAR_BOMBA_DEFAULT_FEED_SLUGS.has(slug)) {
    return "awin:105368";
  }
  return PARTNER_DEFAULT_FEED[partnerId] ?? null;
}

/** "2026-05-15" -> "May 15, 2026". Fixed locale + UTC so SSG output is
 * deterministic regardless of build machine settings. */
export function formatAsOfDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function getPriceAsOf(partnerId: string, slug: string): string | null {
  const feed = getSourceFeed(partnerId, slug);
  return feed ? (FEED_VINTAGE[feed] ?? null) : null;
}
