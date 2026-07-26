# Price Finder — Design & Import Specification

This document is the enforced contract for how a new partner's product data becomes a live, correctly formatted, correctly categorized, searchable part of Price Finder. It covers six things: the compliance gate, the product card layout, the category system, the homepage sections, search, and image handling. For each one, it says what the rule is, where it's enforced in code, and — honestly — whether "enforced" means "the site can't render it wrong" or "the import script won't let bad data through."

Two different enforcement mechanisms are at work here, and it matters which one applies to which rule:

- **Enforced by construction (card layout, homepage sections):** every product, regardless of partner, flows through one shared component or one shared data function. There is no per-partner rendering code left to diverge — you cannot accidentally make one partner's cards a different size, because there is only one card component and it takes no per-partner styling props.
- **Enforced by the import script (categorization, images, data shape):** `scripts/import-partner.mjs` validates and transforms a partner's raw CSV before it ever reaches the app. This is enforcement at the data layer, not the render layer — it stops bad data from being written to `lib/<partner>-data.ts` in the first place.

Search is a bit of both: the ranking algorithm is fixed code, but its precision was hand-tuned against this catalog's real data and should be re-checked if the catalog changes shape a lot (see the Search section).

---

## 0. Compliance Gate

Hard requirement: no partner's products ever display on the live site, and no new partner is ever imported, unless that partner has passed terms review. This is checked in two independent places against one registry, so there's no single point of failure that could let a non-compliant partner through:

- **`scripts/import-partner.mjs`** checks first, before parsing the CSV or writing anything to disk. A partner that fails the hard gate below gets blocked immediately — no data file, no registry wiring, nothing written.
- **`lib/partners.ts`** checks again at render time, independent of the import script. `PARTNERS` (the one list every homepage section, partner page, category page, and search query actually reads from) is `ALL_WIRED_PARTNERS` filtered through the same gate. This matters because a partner's data file existing and being wired into the codebase isn't proof it's still compliant — a status can change after import, or someone could wire a partner in by hand without running the script. The render-time check means neither of those can put a non-compliant partner's products in front of a shopper.

Both checks read `lib/partner-compliance.json` — one registry, one entry per partner (active or not), so an import-time decision and a render-time decision can never disagree.

**The hard gate** — any one of these blocks the partner entirely (import script exits before writing anything; live site never returns that partner's products from `PARTNERS`):

1. No entry for the partner in the registry at all → *"Partner not found in compliance registry — terms must be reviewed before import."*
2. `status` isn't `"active"` → *"Partner is not yet an approved/active affiliate — do not display products live."* (`"pending"` and `"reviewed-not-applied"` both block; only `"active"` passes.)
3. `comparisonEngineConfirmed` is explicitly `false` → *"Partner type hasn't been confirmed as eligible for a comparison site."* — a stricter, comparison-site-specific bar than just "affiliate approved," since some AWIN terms don't confirm eligibility for that specific business model even when the affiliate relationship itself is fine.

**Softer per-partner restrictions** — these don't block the import, but ARE mechanically enforced or flagged:

4. `imageUsagePermission: "pending"` → every real product photo from that partner is replaced with a local placeholder image (`/images/_placeholders/image-pending.png`, reading "Image pending — partner permission not yet confirmed") — enforced in `lib/partners.ts`'s `normalizeProduct()` via `canShowRealImages()`, so it applies regardless of whether the import script actually downloaded real images or not. Currently gates Brooklyn Delhi (awaiting written image-usage confirmation) — its 29 products still display with real names, prices, categories, and working "View on Brooklyn Delhi" links, just with the placeholder photo instead of a real one.
5. `noPlagiarism: true` → the import script compares each product's final description against that row's raw feed text and flags close/verbatim matches in its compliance report for manual rewrite before the partner goes live. This doesn't block the import (the flagged products are still written to the data file) — it's a review flag, not a data-quality gate, since a feed-sourced description is often explicitly permitted by the partner's own terms (only independently-written or feed-sourced text is disallowed from being copied from the vendor's *website* verbatim).
6. `excludedProducts: true` → that partner's products are excluded from Best Sellers and Deals entirely (`lib/partners.ts`'s `getFeaturedDeals()`/`getBestSellers()` both filter out any partner with this flag) until each SKU is individually verified as commission-eligible. Products still appear on the partner's own page and in search — this only gates curated placements where featuring a commission-excluded SKU would be worse than not featuring it at all.

**Verified working**, tested against real scenarios (a synthetic test partner and existing registry entries, since none of the "reviewed-not-applied" partners have data to actually import yet):

- An unrecognized partner ID → blocked, zero files written, exit code 1.
- `aaawave` (`status: "reviewed-not-applied"`) → blocked with the exact reason, before any CSV parsing.
- `energy-muse` (`comparisonEngineConfirmed: false`) → blocked, reporting both the status and comparison-engine reasons together.
- `brooklyn-delhi` (`active`, but `imageUsagePermission: "pending"`) → import proceeds, image download is skipped with an explanation, and confirmed live on the running site: every Brooklyn Delhi product card shows the placeholder image instead of a real photo, while EVDANCE and Golden Maple (no image restriction) are unaffected.

**Updating this registry**: edit `lib/partner-compliance.json` only — add a new partner's entry, or change an existing one's `status`/`imageUsagePermission`/etc. Both the import script and the live site pick up the change automatically; nothing else needs to change for a compliance decision to take effect everywhere.

---

## 1. Product Card Layout

Every real product on the site — homepage rails, partner pages, category pages, search results, "more from this category" — renders through exactly one component: `components/RealProductCard.tsx`. There is no second card implementation to keep in sync, so this section is a description of that one component's exact values, not a policy that has to be separately enforced.

**Card shell**
- Rounded corners: `rounded-3xl` (24px)
- Border: 1px, `gilt-500` at 25% opacity
- Shadow: `shadow-soft` at rest, `shadow-soft-xl` on hover
- Hover motion: lifts 4px (`-translate-y-1`) with a 200ms ease-out transition
- Background: `noir-800`
- Height: `h-full` — cards in the same row/rail are always equal height, driven by the fixed-height rows below, not by content happening to be the same length

**Product image**
- Aspect ratio: 1:1 (`aspect-square`), full card width
- Fit: `object-cover` (crops to fill, never stretches)
- Hover motion: 5% scale-up (`group-hover:scale-105`) over 300ms, clipped by the card's `overflow-hidden`
- Responsive `sizes`: 50vw on mobile, 33vw ≥640px, 25vw ≥1024px — matches the grid's actual column count at each breakpoint so the browser never downloads a bigger image than it displays
- Badge (New / Best Seller): pinned top-left, 12px inset, `bg-gilt-500` pill, 11px semibold text, only rendered when `product.badge` is set — no badge, no reserved space (badges are decorative, not structural)

**Text block** (16px padding all sides)
- Row 1 — category / partner: 11px uppercase, `ivory-400`, category left-aligned and partner name right-aligned on the same line
- Row 2 — name / price: name is 16px semibold display font, clamped to 2 lines (`line-clamp-2`) with a `min-h-[2.75rem]` (44px) reserved regardless of actual length, so a one-line name and a two-line name produce identically tall cards; price sits to the right at 18px semibold, with the original price (if any) shown struck through at 12px immediately after it
- Row 3 — rating: fixed 20px-tall row (`h-5`) whether or not the product has a rating — a star icon + rating value + review count when present, or "No ratings yet" in muted text when absent. This fixed height is what keeps a rated product's card the same height as an unrated one.
- Row 4 — price history sparkline (`PriceHistorySparkline`)
- Row 5 — actions, pinned to the card's bottom via `mt-auto` regardless of how much the rows above take up:
  - "View Details" — internal link to this product's own page on Price Finder, outlined pill, `noir-700` background
  - "View on [Partner Name]" — the affiliate deep link, opens in a new tab (`target="_blank" rel="noopener noreferrer sponsored"`), solid `gilt-500` pill with an external-link icon. The label always names the actual partner ("View on Golden Maple", "View on EVDANCE") rather than a generic "Buy Now" — accurate for a referral link that lands on the partner's own store rather than completing a purchase on Price Finder itself.
  - Both buttons share one row, equal width (`flex-1` each), same size — neither reads as the "real" action with the other as an afterthought

**Card-to-card spacing**
- Horizontal rails (Featured Deals, Best Sellers): `gap-5` (20px) between cards, `scrollbar-hide` momentum scroll
- Grids (partner pages, category pages, search results): `gap-4` on mobile, `gap-6` at `sm:` and up, laid out 2 columns on mobile up to 4 on desktop (`grid-cols-2 sm:gap-6 lg:grid-cols-4`)

Because every one of these values lives in one file, adding a partner never touches card layout — a new partner's products are simply more `RealProduct` objects flowing through the same component.

---

## 2. Category System

**The problem this replaces:** with 3 partners, the site had accumulated 22 raw, partner-specific subcategories (`Food`, `Cook Book`, `Clothing`, `Bag`, `Fridge Accessories` from Brooklyn Delhi; six separate EVDANCE ones like `Charging Adapters` and `Wall-Mounted Chargers`; eleven separate Golden Maple ones like `Art Tools`, `Brushes`, `Model Making`). Rendered directly as category tiles, that's 22 near-empty tiles for a shopper to page through — not a browsable structure.

**The fix:** a keyword-based parent-category taxonomy in `config/category-rules.json`, consumed identically by the live site (`lib/category-map.ts`) and the import script (`scripts/import-partner.mjs` reads the same JSON file directly), so a product's parent category can never differ between "what the script classified it as during import" and "what the site displays" — they're the same lookup against the same file.

**How classification works:** each parent category rule has a list of lowercase keyword substrings. A raw subcategory (e.g. "Extension Cords & Cables") is checked against each parent's keywords in order; the first parent whose keyword list contains a case-insensitive substring match wins. A raw subcategory matching nothing falls through to a `General Merchandise` fallback — every product always gets a parent category, never `undefined` or a dropped product.

**The five parent categories**, and exactly which products currently populate them (verified against the live catalog, 449 real products across 3 partners):

| Parent category | Keywords (partial) | Products | Raw subcategories folded in |
|---|---|---|---|
| Food & Kitchen | food, cook, kitchen, snack, condiment, grocery, fridge, pantry, beverage | 25 (Brooklyn Delhi) | Food, Cook Book, Fridge Accessories |
| Apparel & Accessories | cloth, apparel, wear, bag, tote, shirt, hat, shoe | 5 (Brooklyn Delhi) | Clothing, Bag |
| EV Charging & Accessories | "ev ", "ev-", "ev&", charg, extension cord | 72 (EVDANCE) | Extension Cords & Cables, Charging Adapters, Portable EV Chargers, EV Accessories, Wall-Mounted Chargers, EV Charging Accessories |
| Art & Craft Supplies | art, craft, brush, paint, draw, model, hobby, miniature, tape, adhesive, instrument, collect, toy, beauty | 348 (Golden Maple) | Art Tools, Art Toys, Beauty Tools, Brushes, Collectables, Craft Materials, Drawing & Painting Kits, Instrument Accessories, Model Making, Tapes & Adhesives, Art Supplies |
| Home & Living | home, decor, garden, furniture, storage, organiz | 0 — reserved for a future partner | none yet |

`General Merchandise` (the fallback) is also currently empty — every existing product matched a real parent.

Note on the example in the original request: "Home & Garden instead of separate Fridge Accessories + Art Supplies" was the illustrative example given, but merging fridge magnets with paintbrushes into one bucket doesn't reflect what those products actually are to a shopper — a taxonomy that group anything-with-a-loose-keyword-match together isn't more useful than 22 tiles, just fewer of them. The five categories above were designed from what the real product data actually contains, and "Home & Garden" doesn't appear because nothing in the current catalog is actually home-and-garden merchandise — `Home & Living` is defined and ready for the day a partner sells planters or furniture, but an empty category tile never renders (see Homepage Sections below), so it stays invisible until then rather than showing as a broken promise.

**Auto-categorization for new imports:** this is not a manual step. `scripts/import-partner.mjs` calls the same classifier during CSV import, using each row's own category column, and reports the resulting category → parent-category breakdown as part of its console output before writing anything — so you see the classification decisions before they're committed, but you never make them by hand.

**To extend the taxonomy** (new parent category, or teaching an existing one about a new kind of product): edit `config/category-rules.json` only. Both the site and the import script pick up the change automatically — there is deliberately no second copy of this logic anywhere else in the codebase.

---

## 3. Homepage Sections

The homepage (`app/page.tsx`) renders ten sections in a fixed order:

1. **Hero** — static, not data-driven
2. **Our Partners** — every entry in `lib/partners.ts`'s `PARTNERS` array, one card per partner with its tagline and a link to its page. A new partner appears here automatically the moment it's added to `PARTNERS` (which the import script does for you).
3. **Under Construction** — static messaging, sets expectations that the catalog is real but still growing
4. **Featured Deals** — `getFeaturedDeals()`: every real product where `originalPrice > price`, sorted by markdown percentage, descending. This is a real-markdowns-only rule, not a curated list — a product with no discount never appears here, and the section hides itself entirely if nothing currently qualifies.
5. **Loyalty** — static
6. **Best Sellers** — `getBestSellers()`: products carrying a `"Best Seller"` badge in their source data; if none exist yet, falls back to the 8 highest-rated products instead of showing an arbitrary/empty section.
7. **Savings Dashboard** — static summary UI
8. **Popular Categories** — `getRealCategories()`: one tile per parent category that currently has at least one real product, each tile's image pulled from that category's first real product photo (never a placeholder), each tile linking to `/category/[slug]`. A parent category with zero products (like `Home & Living` right now) simply doesn't render a tile — the section's size tracks the real catalog, not the taxonomy's full list.
9. **Why Price Finder** — static
10. **How It Works** — static

The rule that makes this "auto-populate with no manual tweaks" true: every data-driven section above reads from `lib/partners.ts`'s exported functions (`getFeaturedDeals`, `getBestSellers`, `getRealCategories`, `getAllRealProducts`), and every one of those functions derives its output by scanning `PARTNERS` fresh each call — there's no separate "homepage content" list to remember to update. Once `scripts/import-partner.mjs` wires a new partner into `PARTNERS`, that partner's qualifying products appear in Featured Deals, Best Sellers, and Popular Categories on the next build with zero additional edits.

---

## 4. Search Integration

Search (`lib/search.ts`, used by `app/search/page.tsx`) uses Fuse.js for fuzzy, typo-tolerant matching — replacing a plain substring match that could already find "paintbrush" for a "brush" query (literal substring) but couldn't find "Achaar" for an "achar" query (a one-character edit away, never a literal substring).

**Configuration**, tuned against the real ~450-product catalog rather than a toy example:
- Fields searched: `name` (weight 0.8), `category` (0.15), `description` (0.05) — name dominates so a query matching the product's own title always outranks one that only happens to appear in filler text
- Constructor `threshold: 0.5` controls which candidates Fuse considers at all; the actual relevance filter is a manual post-search cutoff, `SCORE_CUTOFF = 0.52`, applied to `result.score` — Fuse's `threshold` is *not* a hard cutoff on the score it reports, a common misreading of its docs
- `ignoreLocation: true` so a match late in a long product name (e.g. "brush" inside "6pcs Sable Hair Round Point Watercolor Brushes") isn't penalized for not being near the start

**Why these specific numbers:** an earlier version weighted `category`/`description` more heavily (0.2 each) and used a looser cutoff (0.6). That passed an initial test battery, but a follow-up check surfaced a real false positive: "achar" was fuzzily close enough to the word "Adapter" (which appears in both the name and category of EVDANCE's charging-adapter products) that adapter products scored in the same 0.53–0.60 band as genuine Achaar matches — no single cutoff could separate them. The fix was to weight `name` much more heavily (0.8) and tighten the cutoff (0.52), which cleanly separates the two: "achar" now returns only the 5 genuine Achaar-related products (Tomato Achaar, Roasted Garlic Achaar, and their T-shirt/tote spinoffs), with zero EVDANCE results.

**Verified working**, tested directly against the live `/search` page:
- "brush" → paintbrush, brush sets, brush cleaners (partial-word match)
- "achar" → Achaar products only, no false positives (typo/omission tolerance)
- "chutny" → Chutney products (typo tolerance)
- "tesla", "kolinsky", "evdanc" → sensible partial/typo matches
- "ipad", a random nonsense string → 0 results (no noise)

**If the catalog changes shape a lot** (a new partner whose product names collide with another partner's the way "adapter" collided with "achar"), re-run a query battery against `getAllRealProducts()` before assuming these numbers still hold — Bitap collisions are a function of the actual string data in the catalog, not just these constants. This is genuinely data-dependent tuning, not a fixed algorithm that's correct for any possible catalog.

---

## 5. Image Handling

Enforced by `scripts/import-partner.mjs` at import time, not by anything in the app (the app just renders whatever's in `public/images/`):

- **Format:** WebP, quality 82 — the format already used by most existing product images in this repo, and the best size/quality tradeoff for product photography
- **Dimensions:** resized to fit within 1600×1600, aspect ratio preserved, `withoutEnlargement: true` so a smaller source photo is never upscaled and blurred. Next.js's own `next/image` component (used by every card and detail page) generates the actual responsive srcset sizes a browser downloads from this one canonical file — there's no need to pre-generate multiple physical sizes per product.
- **Folder structure:** `public/images/<partner-id>/<product-slug>.webp` for the primary photo, `<product-slug>-2.webp`, `-3.webp`, etc. for additional gallery images from the source feed
- **Download behavior:** concurrency-limited (8 at a time), skips any file that already exists (so an interrupted run can just be re-run without re-downloading everything), and a failed download is logged with its specific error and URL rather than silently dropped — the generated data file still references the intended local path, so a later re-run (from a machine with network access to that specific image host) fills in the gap without regenerating anything else

**Verified working end-to-end:** the download → sharp resize → WebP conversion pipeline was tested against a real external image URL and confirmed correct (output file `format: webp`, dimensions preserved for a smaller-than-1600 source, no upscaling). Separately, it was confirmed that the Cowork cloud sandbox this script was developed in cannot reach arbitrary external image hosts — `picsum.photos`, `httpbin.org`, and `gopricefinder.com` itself all returned `403` from this sandbox's network layer specifically (while `raw.githubusercontent.com`, which is allowlisted, worked fine) — which is a sandbox network restriction, not a bug in the script. Running an actual partner import that needs to fetch images from that partner's own CDN requires running the script from a machine with normal internet access, matching the script's own `--skip-images` escape hatch (generate the data file first, fetch images in a later pass once you're on such a machine).

---

## What "drop in any CSV" actually means

The request was for a script that makes "dropping in any new partner CSV produce a perfectly formatted, categorized, searchable site update with zero manual fixes." Here's what that claim actually covers, and where it has a real, stated limit:

**True with zero manual fixes**, for a CSV whose columns are close enough to Awin-feed-style naming (`search_price`/`price`, `image_link`, `merchant_deep_link`, `category`, etc. — the shape both EVDANCE's and Golden Maple's real feeds already use):
- Column detection, row validation (required fields, positive price, valid deep link, description length), and clear per-row warnings for anything skipped
- Parent-category classification, using the exact same rules the live site uses
- Image download, resize, and WebP conversion, with per-partner/per-product folder structure
- Generation of `lib/<partner-id>-data.ts` in the same shape every other partner's data file already uses
- Wiring the partner into `lib/partners.ts` — the import statement and the `PARTNERS` registry entry — via the two marker comments in that file, mechanically, which is specifically what closes the gap that caused EVDANCE and Golden Maple to silently show 0 products on the live site the first time they were added by hand (their data files existed but were never registered)
- Self-verification: the script runs `tsc --noEmit` and `eslint` against its own output and reports pass/fail before you commit

**Not automatic, needs one small step:** a CSV whose column names genuinely don't match the default candidates needs a `--mapping` JSON file telling the script which header means what — a 10-line file, not a rewrite, but real config the first time you onboard a partner whose feed is shaped differently. Claiming this never happens for a literally arbitrary, unknown spreadsheet would be overselling what the script does.

**Still a manual step after the script runs, every time:** creating `app/<partner-id>/page.tsx` and `app/<partner-id>/[slug]/page.tsx` (the partner's own listing and product-detail routes) — these are page-level Next.js routes, copied from an existing partner's and had the partner id/name swapped in. The script prints this reminder every time it finishes. Everything else described above — card rendering, categorization, homepage sections, search, and images — needs no further edits once those two files exist.
