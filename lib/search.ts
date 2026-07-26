/**
 * Fuzzy search over the real product catalog, replacing the old plain
 * substring match. Substring matching already found "paintbrush" for a
 * "brush" query (it's a literal substring), but it couldn't find
 * "Achaar" for an "achar" query — a one-character typo/omission — because
 * "achar" is never a literal substring of "achaar". Fuse.js's approximate
 * (Bitap) matching tolerates that kind of small edit distance, so both
 * partial matches and small typos now work.
 *
 * Tuning notes, verified against the real ~450-product catalog (not just
 * a toy example) before landing on these numbers — this went through two
 * rounds of tuning, and the history matters for anyone touching this file:
 *
 * - `threshold: 0.5` on the Fuse instance controls what Bitap is willing
 *   to *consider* a candidate match at all — it is NOT a hard cutoff on
 *   the final relevance `score` Fuse reports (a common misread of Fuse's
 *   docs). **`SCORE_CUTOFF` below does the actual filtering**, applied
 *   manually to `result.score` after search.
 * - Round 1 weighted `category`/`description` at 0.2 each alongside `name`
 *   at 0.5, with `SCORE_CUTOFF: 0.6`. That passed a first battery of
 *   queries, but a follow-up check against the live /search page surfaced
 *   a real false positive: "achar" (meant to fuzzy-match "Achaar") also
 *   matched EVDANCE's "Charging Adapter" products, because "achar" and
 *   "adapter" are Bitap-close enough that their scores land in the same
 *   0.53–0.60 band as the genuine Achaar matches — no single cutoff
 *   separates them when `category`/`description` carry real weight (the
 *   word "Adapter" appearing in both the name AND the category compounds
 *   the false match).
 * - Round 2 fix: weight `name` much more heavily (0.8) and `category`/
 *   `description` much less (0.15/0.05 — kept, not dropped to 0, so a
 *   query that's genuinely about a category like "cookbook" still works),
 *   and tighten `SCORE_CUTOFF` to `0.52`. Re-verified against the same
 *   battery plus the achar/adapter case specifically: "achar" now returns
 *   only the 5 genuine Achaar products (Tomato Achaar, Roasted Garlic
 *   Achaar, and their T-shirt/tote spinoffs, scores 0.40–0.52) with zero
 *   EVDANCE results (best EVDANCE score for "achar" is 0.57, now excluded).
 *   "brush" → paintbrush/kolinsky/etc., "chutny" → Chutney products,
 *   "tesla" → EVDANCE Tesla items, and nonsense queries ("ipad", a random
 *   string) → 0 results all still hold.
 * - If the catalog composition changes a lot (a new partner whose product
 *   names collide with another partner's the way "adapter" collided with
 *   "achar"), re-run a query battery like the one above against
 *   `getAllRealProducts()` before assuming this still holds — Bitap
 *   collisions are a function of the actual string data, not just these
 *   constants.
 * - `ignoreLocation: true` — without this, Fuse penalizes matches that
 *   aren't near the start of the string, which would hurt a match like
 *   "brush" inside "6pcs Sable Hair Round Point Watercolor Brushes"
 *   (the match is near the end).
 */

import Fuse, { type IFuseOptions } from "fuse.js";
import { getAllRealProducts, type RealProduct } from "./partners";

const FUSE_OPTIONS: IFuseOptions<RealProduct> = {
  keys: [
    { name: "name", weight: 0.8 },
    { name: "category", weight: 0.15 },
    { name: "description", weight: 0.05 },
  ],
  threshold: 0.5,
  ignoreLocation: true,
  minMatchCharLength: 3,
  includeScore: true,
};

/** See the file-level comment — this is the number doing the actual
 * relevance filtering, not the Fuse `threshold` option above. */
const SCORE_CUTOFF = 0.52;

// Building the Fuse index re-scans every product, so it's cached at
// module scope rather than rebuilt on every search call/request — cheap
// to keep in memory at this catalog size (hundreds of products), and
// correctness doesn't suffer since this module (and the product data it
// indexes) only changes at build/deploy time, not at runtime.
let cachedFuse: Fuse<RealProduct> | null = null;
function getFuse(): Fuse<RealProduct> {
  if (!cachedFuse) {
    cachedFuse = new Fuse(getAllRealProducts(), FUSE_OPTIONS);
  }
  return cachedFuse;
}

/** Fuzzy, typo-tolerant search across product name, category, and
 * description. Returns real products only, ranked by Fuse's relevance
 * score (best match first), filtered to results actually relevant enough
 * to show (see SCORE_CUTOFF above). */
export function searchRealProducts(query: string): RealProduct[] {
  const q = query.trim();
  if (!q) return [];
  return getFuse()
    .search(q)
    .filter((result) => (result.score ?? 1) <= SCORE_CUTOFF)
    .map((result) => result.item);
}
