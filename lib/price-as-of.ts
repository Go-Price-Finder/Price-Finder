/**
 * FEED → PARTNER MAPPING. This module used to own the "Price as of" DATE
 * as well; it does not any more.
 *
 * WHAT WAS DELETED, 2026-08-22 (§76), and why it must not come back.
 *
 * `FEED_VINTAGE` was a hand-maintained Record<feedId, isoDate> and
 * `getPriceAsOf()` returned it as the displayed stamp for any product
 * without a live price. Its own header said "UPDATE THE AFFECTED FEED'S
 * VINTAGE IN THE SAME COMMIT as any catalog price refresh". Nobody did,
 * because nothing enforced it and nothing could see that it had not
 * happened.
 *
 * The measured result on 2026-08-22: ~298 products (23% of the catalog)
 * displayed "Price as of Jul 25, 2026" while their feeds — F1320, F2615,
 * F2639 — had exported that same morning. The date was not stale data.
 * It was the mtime of a TypeScript file rendered as a merchant fact.
 *
 * It also concealed a second defect. The stamp/chart agreement test
 * reported 988 of 988 and was read as complete; the catalog is 1,288.
 * The missing 300 were exactly this population, silently outside the
 * check because a constant has no provenance to agree or disagree with.
 *
 * THE REPLACEMENT IS NOTHING. A product with no real vintage renders no
 * stamp (resolveAsOfStamp). Do not reintroduce a default, a fallback, an
 * "approximately", or an import date. scripts/check-rendered-claims.mjs
 * enforces the absence.
 *
 * WHAT SURVIVES here is only the feed→partner mapping, which is still
 * needed so snapshotPrices can stamp each price_history row with the id
 * of the feed that produced it. That is provenance, not a date.
 */

/** Which feed a partner's products come from, unless overridden below. */
const PARTNER_DEFAULT_FEED: Record<string, string> = {
  "brooklyn-delhi": "csv:brooklyn-delhi",
  "canvas-vows": "awin:103552",
  evdance: "awin:F1320",
  "golden-maple": "awin:F2615",
  "king-koil": "awin:101819",
  "tsar-bomba": "awin:113495",
  aaawave: "awin:F2639",
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

/**
 * The `feed_status.feed_id` for a product's source feed, or null.
 *
 * Bridges this module's internal key space ("awin:113495",
 * "csv:brooklyn-delhi") to the feed_status table's own ids ("113495",
 * "none:brooklyn-delhi"), so the snapshot job can stamp each
 * price_history row with the vintage of the feed that produced it
 * (findings §53).
 *
 * Deliberately reuses getSourceFeed rather than re-deriving: tsar-bomba
 * draws from two feeds and the per-product split lives in
 * TSAR_BOMBA_DEFAULT_FEED_SLUGS above. A second implementation of that
 * split is a second thing to keep in step.
 *
 * The caller MUST treat an id absent from feed_status as unknown and
 * write NULL — never as "no refresh happened". Absence of a record is
 * not a record of absence, which is the whole lesson of §46.
 */
export function getSourceFeedStatusId(
  partnerId: string,
  slug: string
): string | null {
  const key = getSourceFeed(partnerId, slug);
  if (!key) return null;
  if (key.startsWith("awin:")) return key.slice("awin:".length);
  if (key.startsWith("csv:")) return `none:${key.slice("csv:".length)}`;
  return key;
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

