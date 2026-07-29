/**
 * Maps any product (from any partner, any feed shape) into the Walmart-
 * style taxonomy in config/walmart-taxonomy.json. Rule-based, not ML —
 * every signal below is explainable, and confidenceScore is a heuristic
 * sum of those signals (0-100), not a statistical probability. Read it as
 * "how many independent things pointed the same direction," not "percent
 * chance of being correct."
 *
 * Scoring layers, in order of how much they contribute per candidate leaf
 * node (department > category > productTypeGroup > productType):
 *   1. Keyword match — product title/description and partnerCategory
 *      checked against every productType, productTypeGroup, and category
 *      name in the taxonomy. Exact phrase match scores higher than a
 *      partial (stemmed) word-overlap match. partnerCategory matches score
 *      slightly higher than free-text matches, since it's cleaner,
 *      partner-structured data rather than marketing copy.
 *   2. Brand intelligence — a small table of known luxury-watch and
 *      mattress brands, since those two categories are unusually
 *      brand-identifiable (see PART 2 of the spec this implements).
 *   3. Price signals — a small table of expected price ranges for a
 *      handful of product types where price is genuinely informative
 *      (watches, mattresses, casual clothing). Deliberately not applied
 *      to most product types, where price alone says very little.
 *   4. Partner-specific bias — lightweight nudges for partners whose
 *      general business is already known (King Koil sells mattresses,
 *      Tsarbomba sells watches, etc.), on top of the generic signals
 *      above rather than replacing them.
 *
 * Fallback hierarchy: the highest-scoring leaf node wins, even at low
 * confidence — a real (if uncertain) guess beats silence, and the score
 * itself communicates the uncertainty. Only a product that scores exactly
 * zero everywhere (no keyword/brand/price/partner signal at all) falls
 * back to the explicit UNCLASSIFIED result, mirroring this project's
 * existing "General Merchandise" fallback pattern in
 * lib/category-map.ts/config/category-rules.json.
 */

import taxonomy from "@/config/walmart-taxonomy.json";

export type ProductInput = {
  title: string;
  description: string;
  brand: string;
  /** Raw category string from the partner's own feed, e.g. "Home Décor". */
  partnerCategory?: string;
  price: number;
  url: string;
  partnerId: string;
};

export type CategoryMapping = {
  department: string;
  category: string;
  productTypeGroup: string;
  productType: string;
  confidenceScore: number;
};

type LeafNode = {
  department: string;
  category: string;
  productTypeGroup: string;
  productType: string;
};

const LEAF_NODES: LeafNode[] = [];
for (const dept of taxonomy.departments) {
  for (const cat of dept.categories) {
    for (const ptg of cat.productTypeGroups) {
      for (const productType of ptg.productTypes) {
        LEAF_NODES.push({
          department: dept.name,
          category: cat.name,
          productTypeGroup: ptg.name,
          productType,
        });
      }
    }
  }
}

export const UNCLASSIFIED: CategoryMapping = {
  department: "Unclassified",
  category: "Unclassified",
  productTypeGroup: "Unclassified",
  productType: "Unclassified",
  confidenceScore: 0,
};

// ---------------------------------------------------------------------------
// Text matching
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Crude English stemming (plural -> singular) — enough to match "brush"
 * against "Brushes" or "mattress" against "Mattresses" without a real
 * NLP dependency, which would be overkill for matching against a fixed,
 * known taxonomy vocabulary. */
function wordStems(word: string): string[] {
  const forms = new Set([word]);
  if (word.endsWith("ies") && word.length > 4) forms.add(word.slice(0, -3) + "y");
  if (word.endsWith("es") && word.length > 3) forms.add(word.slice(0, -2));
  if (word.endsWith("s") && word.length > 3) forms.add(word.slice(0, -1));
  return [...forms];
}

type MatchWeight = { exact: number; partial: number };

/** Whole-word set for a haystack, including each word's stemmed forms —
 * matched by set membership, not substring containment. Substring
 * containment was the actual bug here: stemming "Vases" to "vas" and then
 * checking `haystack.includes("vas")` matched inside "canvas", a totally
 * unrelated word, because "vas" is a substring of it. Word-set membership
 * only matches "vas" against an actual word "vas" in the haystack. */
function haystackWordSet(haystack: string): Set<string> {
  const words = normalize(haystack).split(" ").filter(Boolean);
  const set = new Set<string>();
  for (const w of words) {
    set.add(w);
    for (const stem of wordStems(w)) set.add(stem);
  }
  return set;
}

/** Scores a haystack against a taxonomy phrase using `weight`, returning a
 * number instead of a flat exact/partial/none level. Partial credit is
 * proportional to how much of the phrase actually matched (hits / total
 * words), not a fixed amount regardless of completeness — that flatness was
 * a real bug: a title matching all 5 words of "Model Scribers & Panel Line
 * Tools" scored identically to a title matching just 1 word of "Model
 * Making Kits", so ties got decided by unrelated smaller bonuses (like a
 * partner-category match) instead of by which candidate actually fit
 * better. That's what kept several correctly-added, more-specific product
 * types ("Model Scribers & Panel Line Tools", "Hobby Clamps & Vises", etc.)
 * from ever winning against their older, more generic siblings even when
 * they were the better match. */
function matchScore(haystack: string, phrase: string, weight: MatchWeight, minDistinctiveLength = 5): number {
  const h = normalize(haystack);
  const p = normalize(phrase);
  if (!p || !h) return 0;
  // Word-boundary substring match, not raw substring — raw `h.includes(p)`
  // let single-word taxonomy phrases match inside unrelated longer words
  // ("Water" matched every "watercolor" mention, exactly the same class of
  // bug as the earlier "vas"-inside-"canvas" partial-match bug, just in the
  // exact-match branch instead). Padding both sides with spaces turns
  // substring containment into word-boundary containment cheaply, since
  // normalize() already collapsed everything to single-spaced a-z0-9 words.
  if (` ${h} `.includes(` ${p} `)) return weight.exact;
  const hWords = haystackWordSet(haystack);
  const pWords = p.split(" ").filter((w) => w.length > 2);
  if (pWords.length === 0) return 0;
  const hits = pWords.filter((w) => wordStems(w).some((form) => hWords.has(form)));
  if (hits.length === 0) return 0;
  // Only count the match at all if either every word hit, or at least one
  // matched word is distinctive enough to mean something on its own. Short
  // generic words ("gift", "set", "home") matching alone caused real false
  // positives: a Giftlab AirPods case matched "Gift Bags" purely because
  // its raw category is "Gifts" and its title says "gift", not because it
  // has anything to do with gift wrap. minDistinctiveLength is configurable
  // per call site (see PARTNER_CAT_WEIGHT usage below) because partner raw
  // categories are short, broad, organizational labels — a 5-char word like
  // "Tools" or "Foods" is far more likely to be a generic catalog-bucket
  // word there ("Art Tools", "Food") than a specific product signal, unlike
  // the same word inside a full product title/description.
  const distinctiveHit = hits.length === pWords.length || hits.some((w) => w.length >= minDistinctiveLength);
  if (!distinctiveHit) return 0;
  // Floor at the old flat partial credit, with completeness adding bonus on
  // top rather than scaling the whole thing down — a straight multiply
  // (weight.partial * ratio) initially seemed right, but it regressed real
  // cases: a single-distinctive-word hit is already the weakest signal this
  // function chooses to trust at all (see distinctiveHit above), and
  // shrinking it further let it drop below flat, unscaled bonuses elsewhere
  // (partner-category bias like golden-maple's +18 for any Arts & Crafts
  // leaf), so near-noise fractional credit started deciding ties instead of
  // genuine signal — "Trapezoidal Cork" started winning "Painting Handle"
  // on essentially nothing. Flooring at the old value guarantees nothing
  // that used to match now scores lower; only more-complete matches score
  // higher than they used to.
  const ratio = hits.length / pWords.length;
  return weight.partial + (weight.exact - weight.partial) * ratio * 0.5;
}

// Title dominates, matching this codebase's own lib/search.ts precedent
// (name weight 0.8 vs description 0.05) — for the same reason: a product's
// title says what it IS, while description is longer, noisier marketing/
// ingredient copy that can accidentally contain an unrelated taxonomy
// term (a chutney's ingredient list mentioning "sugar" shouldn't outscore
// the actual "chutney" match). Description is real signal, just a much
// smaller one, so it isn't zeroed out entirely.
const TITLE_WEIGHT: MatchWeight = { exact: 42, partial: 22 };
const DESCRIPTION_WEIGHT: MatchWeight = { exact: 9, partial: 4 };
const PARTNER_CAT_WEIGHT: MatchWeight = { exact: 30, partial: 15 };
const PTG_WEIGHT: MatchWeight = { exact: 15, partial: 7 };
const CATEGORY_WEIGHT: MatchWeight = { exact: 8, partial: 4 };

// ---------------------------------------------------------------------------
// Brand intelligence
// ---------------------------------------------------------------------------

const LUXURY_WATCH_BRANDS = [
  "rolex", "omega", "tag heuer", "tagheuer", "cartier", "patek philippe",
  "breitling", "tudor", "longines", "tsar bomba", "tsarbomba", "seiko",
  "citizen", "hublot", "iwc",
];

const MATTRESS_BRANDS = [
  "sealy", "serta", "tempur-pedic", "tempurpedic", "casper", "purple",
  "king koil", "kingkoil", "simmons", "beautyrest", "sleep number", "saatva",
];

function brandBonus(brand: string, leaf: LeafNode): number {
  const b = normalize(brand);
  if (!b) return 0;
  const isLuxuryWatch = LUXURY_WATCH_BRANDS.some((x) => b.includes(x));
  const isMattress = MATTRESS_BRANDS.some((x) => b.includes(x));
  if (isLuxuryWatch && leaf.productType === "Luxury Watches") return 35;
  if (isLuxuryWatch && leaf.category === "Watches") return 15;
  if (isMattress && leaf.productType === "Mattresses") return 35;
  if (isMattress && leaf.productTypeGroup === "Bedding") return 15;
  return 0;
}

// ---------------------------------------------------------------------------
// Price signals — only where price is genuinely informative, not applied
// blanket across all 333 product types.
// ---------------------------------------------------------------------------

type PriceHint = { productType: string; min?: number; max?: number; bonus: number };

const PRICE_HINTS: PriceHint[] = [
  { productType: "Luxury Watches", min: 200, bonus: 12 },
  { productType: "Smartwatches", min: 100, max: 900, bonus: 6 },
  { productType: "Mattresses", min: 400, bonus: 12 },
  { productType: "Casual Dresses", min: 20, max: 80, bonus: 6 },
  { productType: "T-Shirts", min: 10, max: 60, bonus: 6 },
  { productType: "Sofas", min: 300, bonus: 8 },
  { productType: "Windows Laptops", min: 300, bonus: 8 },
  { productType: "MacBooks", min: 800, bonus: 8 },
  { productType: "Smartphones", min: 200, bonus: 6 },
];

function priceBonus(price: number, leaf: LeafNode): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const hint = PRICE_HINTS.find((h) => h.productType === leaf.productType);
  if (!hint) return 0;
  if (hint.min !== undefined && price < hint.min) return 0;
  if (hint.max !== undefined && price > hint.max) return 0;
  return hint.bonus;
}

// ---------------------------------------------------------------------------
// Partner-specific bias — lightweight nudges, additive on top of the
// generic signals above, not a replacement for them. Deliberately weak
// for partners with genuinely mixed inventory (Giftlab) and strong only
// where a partner's whole catalog really is that one thing (King Koil,
// Tsarbomba, EVDANCE).
// ---------------------------------------------------------------------------

type PartnerBiasRule = {
  department?: string;
  category?: string;
  productTypeGroup?: string;
  productType?: string;
  bonus: number;
};

const PARTNER_BIAS: Record<string, PartnerBiasRule[]> = {
  "king-koil": [{ productType: "Mattresses", bonus: 30 }],
  "tsar-bomba": [
    { category: "Watches", bonus: 25 },
    { productType: "Luxury Watches", bonus: 15 },
  ],
  giftlab: [{ department: "Home", bonus: 4 }],
  "brooklyn-delhi": [{ department: "Grocery & Food", bonus: 12 }],
  evdance: [{ category: "EV Charging", bonus: 30 }],
  "golden-maple": [{ category: "Arts & Crafts", bonus: 18 }],
};

function partnerBonus(partnerId: string, leaf: LeafNode): number {
  const rules = PARTNER_BIAS[partnerId] ?? [];
  let bonus = 0;
  for (const r of rules) {
    if (r.department && r.department !== leaf.department) continue;
    if (r.category && r.category !== leaf.category) continue;
    if (r.productTypeGroup && r.productTypeGroup !== leaf.productTypeGroup) continue;
    if (r.productType && r.productType !== leaf.productType) continue;
    bonus += r.bonus;
  }
  return bonus;
}

// ---------------------------------------------------------------------------
// Partner-aware hard overrides — for partners whose raw feed collapses
// everything into one or two generic category tags ("Food" for nearly
// Brooklyn Delhi's entire catalog), the generic scorer has too little signal
// to reliably tell curries from chutneys from achaar, let alone notice a
// t-shirt or tote bag isn't food at all. Unlike PARTNER_BIAS above (a small
// nudge on top of the generic score), these rules return a leaf directly,
// skipping the generic scoring loop — appropriate only for small, well-
// understood catalogs reviewed by hand, not a general-purpose mechanism.
// ---------------------------------------------------------------------------

const OVERRIDE_CONFIDENCE = 95;

function hasWord(haystack: string, phrase: string): boolean {
  const h = ` ${normalize(haystack)} `;
  const p = normalize(phrase);
  return h.includes(` ${p} `);
}

function brooklynDelhiOverride(product: ProductInput): LeafNode | null {
  // Title only, not description — descriptions are marketing copy that
  // cross-reference other dishes ("perfect for samosas and curry" on a
  // chutney; "...or achaar" as a serving suggestion on a masala), which
  // caused false hits when first tried against title+description combined.
  // Titles for this catalog are clean, specific labels, so they're reliable
  // enough on their own for a 29-product hand-reviewed override.
  const has = (...phrases: string[]) => phrases.some((p) => hasWord(product.title, p));

  const grocery = (productType: string): LeafNode => ({
    department: "Grocery & Food",
    category: "International",
    productTypeGroup: "International Foods",
    productType,
  });

  // Non-food tail first — some titles contain a food word too (e.g. "Tomato
  // Achaar Tote Bag"), so what the item actually IS must win over what
  // flavor it's branded as.
  if (has("t-shirt", "tshirt")) {
    return {
      department: "Apparel & Accessories",
      category: "Unisex Clothing",
      productTypeGroup: "Tops",
      productType: "T-Shirts",
    };
  }
  if (has("tote", "tote bag")) {
    return {
      department: "Apparel & Accessories",
      category: "Bags & Accessories",
      productTypeGroup: "Handbags",
      productType: "Totes",
    };
  }
  if (has("magnet")) {
    return {
      department: "Party Supplies",
      category: "Novelty & Gifts",
      productTypeGroup: "Novelty Merchandise",
      productType: "Souvenir Magnets",
    };
  }
  if (has("cookbook", "cook book")) {
    return grocery("Cookbooks");
  }

  // Food tail — achaar/pickle and curry-family dishes are distinct enough
  // from a plain chutney to deserve their own product type; chutney is the
  // catalog's actual majority item, so it's also the sensible default for
  // gift boxes/sets that bundle a mix without naming a single dish.
  if (has("achaar", "pickle")) return grocery("Achaar & Pickles");
  if (has("curry", "masala", "korma", "dal", "rajma")) return grocery("Curries & Simmer Sauces");
  return grocery("Indian Condiments & Chutneys");
}

// Golden Maple's own site (artgoldenmaple.com) publishes real categories —
// Miniature Brush, Paints, Tools & Accessories, Art Brushes, each with real
// subcategories — used here as the source of truth instead of continuing to
// tune keyword-matching against the AWIN feed's generic partnerCategory
// tags ("Brushes", "Model Making", "Art Tools", etc.), which is what caused
// the earlier "Diagnostic Tools" and "Model Making Kits" mis-scoring. Unlike
// Brooklyn Delhi's override, this one is partial — it only returns a leaf
// for products confidently matching one of these four real categories by
// title; anything else (terrain materials, dice, tape, model kits) returns
// null and falls through to the generic scorer, which already places those
// reasonably.
/** Like hasWord, but stemming-aware — hasWord's plain word-boundary check
 * missed most of Golden Maple's actual titles ("Brushes" plural didn't
 * match a bare "brush" check). For a single-word phrase, checks membership
 * against the haystack's stemmed word set (reusing the same stems used
 * elsewhere in this file). For a multi-word phrase, only the final word is
 * stemmed (English pluralizes the trailing noun: "dry brush" -> "dry
 * brushes", "wet palette" -> "wet palettes"), then checked as a contiguous,
 * word-bounded phrase. */
function hasPhrase(haystack: string, phrase: string): boolean {
  const words = normalize(phrase).split(" ").filter(Boolean);
  if (words.length === 0) return false;
  if (words.length === 1) {
    const hWords = haystackWordSet(haystack);
    return wordStems(words[0]).some((form) => hWords.has(form));
  }
  const h = ` ${normalize(haystack)} `;
  const last = words[words.length - 1];
  return wordStems(last).some((form) => h.includes(` ${[...words.slice(0, -1), form].join(" ")} `));
}

function goldenMapleOverride(product: ProductInput): LeafNode | null {
  const has = (...phrases: string[]) => phrases.some((p) => hasPhrase(product.title, p));
  // "Paintbrush" appears as one glued word in real titles ("Natural Hair Mop
  // Paintbrush"), which a plain "brush" word-boundary check misses entirely.
  const hasBrush = has("brush", "paintbrush");
  const artsCrafts = (productTypeGroup: string, productType: string): LeafNode => ({
    department: "Arts & Crafts",
    category: "Arts & Crafts",
    productTypeGroup,
    productType,
  });

  // Tools & Accessories checked first — a cleaning/storage/cutting tool
  // that happens to mention "brush" in passing ("Brush Cleaner", "Sanding
  // Tool Organizer") is a tool, not a brush.
  if (has("cleaner", "cleaning", "preserver")) return artsCrafts("Tools & Accessories", "Storage & Cleaning");
  if (has("storage", "organizer", "carrying case", "rack")) {
    return artsCrafts("Tools & Accessories", "Storage & Cleaning");
  }
  if (
    has(
      "sanding", "sandpaper", "cutting mat", "scissors", "clamp", "vise", "drill", "scriber",
      "wiping rod", "rotary craft cutter", "sculpting tool", "craft knife"
    )
  ) {
    return artsCrafts("Tools & Accessories", "Cutting & Sanding");
  }
  if (has("wet palette")) return artsCrafts("Tools & Accessories", "Wet Palettes");
  // "painting handle" only, not bare "handle" — brush titles routinely
  // mention a handle as a feature ("Long Handle for Oil & Acrylic"), which
  // isn't the same as being a standalone handle/grip product.
  if (has("painting handle")) return artsCrafts("Tools & Accessories", "Painting Handle");

  // Paints — only when the product itself is paint, not a brush that's
  // merely described as being for painting.
  if (has("paint set", "acrylic paints") && !hasBrush) {
    return artsCrafts("Paints", "Miniature Paints");
  }

  // Miniature Brush — Golden Maple's core business is miniature/wargaming
  // brushes, so these signals are checked ahead of the general Art Brushes
  // signals below, without requiring the literal word "miniature" — most
  // of these titles don't say it explicitly, they just say "Detail Brush"
  // or "Dry Brush". Kolinsky (a premium, distinctive material) and dry
  // brush (a distinct technique name) are checked before the generic
  // "detail"/synthetic-material fallbacks, since combo sets often bundle
  // more than one of these and the more specific term should win.
  if (has("kolinsky")) return artsCrafts("Miniature Brush", "Kolinsky Sable Brush");
  if (has("dry brush", "drybrush")) return artsCrafts("Miniature Brush", "Dry Brush");
  if (has("detail", "liner") && hasBrush) return artsCrafts("Miniature Brush", "Detail Brush");
  if (has("synthetic", "nylon") && hasBrush) return artsCrafts("Miniature Brush", "Synthetic Hair");

  // Art Brushes — general fine-art brushes, not miniature/hobby-specific.
  // Reached only when nothing above matched.
  if (has("calligraphy")) return artsCrafts("Art Brushes", "Chinese Calligraphy Brush");
  if (has("watercolor") && hasBrush) return artsCrafts("Art Brushes", "Watercolor Brush");
  if ((has("acrylic") || has("oil")) && hasBrush) return artsCrafts("Art Brushes", "Acrylic & Oil Brush");

  return null;
}

// Canvas Vows' entire real feed (204 products, verified against the live
// AWIN feed) is personalized wall-hangable canvas prints — vow/anniversary
// canvases, family name signs, star maps, "guest book" canvases guests
// sign directly. Every product's description confirms it ships as a
// ready-to-hang canvas, including the ones that don't sound like it from
// the title alone ("Wedding Guest Book": "Your design is printed onto a
// canvas... Ready to hang"). No sub-differentiation needed — unlike
// Brooklyn Delhi/Golden Maple, this partner's whole catalog is one product
// type, so the override doesn't branch on keywords at all.
function canvasVowsOverride(): LeafNode {
  return {
    department: "Home",
    category: "Decor",
    productTypeGroup: "Wall Decor",
    productType: "Wall Art",
  };
}

const PARTNER_OVERRIDES: Record<string, (product: ProductInput) => LeafNode | null> = {
  "brooklyn-delhi": brooklynDelhiOverride,
  "golden-maple": goldenMapleOverride,
  "canvas-vows": canvasVowsOverride,
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function mapProductToCategory(product: ProductInput): CategoryMapping {
  const override = PARTNER_OVERRIDES[product.partnerId]?.(product);
  if (override) {
    return { ...override, confidenceScore: OVERRIDE_CONFIDENCE };
  }

  const partnerCat = product.partnerCategory ?? "";
  const combined = `${product.title} ${product.description} ${partnerCat}`;

  let best: { leaf: LeafNode; score: number } | null = null;

  for (const leaf of LEAF_NODES) {
    let score = 0;

    score += matchScore(product.title, leaf.productType, TITLE_WEIGHT);
    score += matchScore(product.description, leaf.productType, DESCRIPTION_WEIGHT);
    if (partnerCat) {
      // Stricter distinctiveness bar (6 vs the default 5) than title/
      // description matching — raw partner categories are short, generic,
      // catalog-bucket labels ("Art Tools", "Food"), so a single coincidental
      // word match there is riskier than the same word inside a full product
      // title. This is what caught Golden Maple's "Art Tools" wrongly
      // matching "Diagnostic Tools" (Automotive) via the shared word "tools".
      score += matchScore(partnerCat, leaf.productType, PARTNER_CAT_WEIGHT, 6);
    }
    score += matchScore(combined, leaf.productTypeGroup, PTG_WEIGHT);
    score += matchScore(combined, leaf.category, CATEGORY_WEIGHT);

    score += brandBonus(product.brand, leaf);
    score += priceBonus(product.price, leaf);
    score += partnerBonus(product.partnerId, leaf);

    if (!best || score > best.score) {
      best = { leaf, score };
    }
  }

  if (!best || best.score <= 0) {
    return UNCLASSIFIED;
  }

  return {
    department: best.leaf.department,
    category: best.leaf.category,
    productTypeGroup: best.leaf.productTypeGroup,
    productType: best.leaf.productType,
    confidenceScore: Math.max(1, Math.min(100, Math.round(best.score))),
  };
}
