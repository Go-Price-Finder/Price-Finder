/**
 * Per-partner "price as of" dates for the displayed (catalog) prices.
 *
 * THE DATE IS THE CATALOG'S LAST PRICE-VERIFICATION DATE, NOT THE FEED'S
 * LAST-IMPORT DATE. Displayed prices come from catalog_products (via
 * lib/catalog.ts), which is refreshed only by explicit imports — so a
 * partner whose AWIN feed updates daily (king-koil) still displays prices
 * from the last catalog refresh. Dating the label off the feed would
 * overclaim freshness for every partner whose feed outruns their catalog.
 * If live-price display ever ships (Option A, chosen but not shipped —
 * claude/pricing-pipeline-findings-2026-08-16.md §6), the honest source
 * becomes the feed's Last Imported and this map is superseded.
 *
 * Derivation per partner (git history + feed vintage, established
 * 2026-08-17):
 * - canvas-vows: 2026-05-15 — imported 2026-07-29 (4f6f302) from AWIN feed
 *   103552, whose content froze at AWIN on 2026-05-15. The import date is
 *   NOT the data's date; the feed served a May-15 snapshot. A full-catalog
 *   census against the merchant (2026-08-16) found 93 of 194 title-matched
 *   prices no longer match any live variant — this is the partner the
 *   label exists for.
 * - king-koil: 2026-08-02 — catalog refreshed from a then-current feed
 *   (87877a2).
 * - tsar-bomba: 2026-08-02 — same refresh (87877a2). CAVEAT: 26 of 272
 *   products came from the Default feed (105368), frozen since 2026-05-15,
 *   so their price data is May-15 vintage behind an Aug-2 label.
 *   Per-product precision is a v2; the per-partner date is the majority
 *   truth (246 of 272 from the then-current US feed).
 * - brooklyn-delhi: 2026-07-25 — original import (8f1342a); no AWIN feed
 *   exists for this advertiser, so no later verification has been possible.
 * - evdance / golden-maple: 2026-07-25 — original import (14dc4cf).
 *   Fresher verified prices exist in current_prices (refresh-prices cron)
 *   but are not displayed; the label dates what is shown.
 *
 * These are hand-maintained. UPDATE THE AFFECTED PARTNER'S DATE IN THE
 * SAME COMMIT as any catalog price refresh/re-import — a stale entry here
 * recreates the exact dishonesty this label exists to end.
 */

const PRICE_AS_OF: Record<string, string> = {
  "brooklyn-delhi": "2026-07-25",
  "canvas-vows": "2026-05-15",
  evdance: "2026-07-25",
  "golden-maple": "2026-07-25",
  "king-koil": "2026-08-02",
  "tsar-bomba": "2026-08-02",
};

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

export function getPriceAsOf(partnerId: string): string | null {
  return PRICE_AS_OF[partnerId] ?? null;
}
