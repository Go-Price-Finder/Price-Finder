/**
 * Rendered-output claims tripwire (findings §23/§24/§25/§28/§30).
 * Permanent, not a one-off, and the reason is the footer Subscribe form:
 * an email field whose submit handler was a deliberate no-op collected
 * visitors' emails under a promise of price alerts and discarded them, on
 * every page — and NO source-level review would have caught it, because
 * the source looked like a working form. Claims have to be checked where
 * the visitor meets them: in the rendered output.
 *
 * TWO SEVERITIES (operator ruling 2026-08-19, findings §30):
 *
 *  NEVER_ASSERT — false as a claim in OUR OWN VOICE, but legitimate
 *  inside editorial prose that quotes or refutes it (the first guide
 *  does exactly that with urgency language). Enforced on site chrome
 *  (top-level routes); NOT enforced on guides.
 *
 *  NEVER_APPEAR — must not exist on ANY surface regardless of framing.
 *  Dead-control labels live here: no editorial context redeems a string
 *  whose only site history is a control that lied.
 *
 * GUIDES (.next/server/app/guides/**.html) are scanned against
 * NEVER_APPEAR only. This is the deliberately NARROW option of the two
 * the operator offered: reliable quote/refutation detection over
 * rendered HTML is more machinery than it is worth (a regex cannot tell
 * quoting from asserting, and a wrong guess in either direction is worse
 * than the gap), and a per-guide allowlist accumulates an exception per
 * article until the list is noise. So the machine checks guides for the
 * absolute strings, and editorial prose is reviewed by the §23 method at
 * authoring time — a narrower check that is correct, over a broader one
 * that trains people to allowlist their way past it.
 *
 * WHAT THIS IS NOT: a semantic audit. A NEW false claim in fresh wording
 * passes — the §23 method (extract every claim, verify each against what
 * the code does) remains session work whenever self-description copy
 * changes.
 *
 * Runs as package.json "postbuild": npm run build fails on a hit.
 * SELFTEST: CLAIMS_CHECK_SELFTEST=1 bans a phrase that IS present
 * ("checked") on chrome AND a guide-present phrase ("memory") on guides —
 * MUST exit nonzero on both surfaces.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP_DIR = ".next/server/app";
const GUIDES_DIR = join(APP_DIR, "guides");

// Severity: NEVER ASSERT in our own voice (site chrome only).
// Every entry names the §-recorded falsehood that put it here.
const NEVER_ASSERT = {
  "data collection in progress": "the v2 placeholder that became its own false claim (§23)",
  "in development": "said of drop alerts long after they shipped (§23)",
  "coming soon": "said of price-history tracking while recording was already live (§23)",
  "checked weekly": "the cron has run daily since it existed (§23)",
  "checked every week": "same (§23)",
  "side by side": "cross-store same-product comparison does not exist yet (§23; remove when it ships)",
  "best price": "described a badge that exists nowhere (§23; remove when the comparison surface ships)",
  "scan the whole market": "we search our own partner catalog, not the market (§23)",
  "tracking since launch": "the sparkline presented feed markdowns as observed price drops and claimed 'no changes yet' where changes were recorded (§25/§27)",
  // These three are REGEXES, not substrings, and the reason is a finding
  // (§43). Banning the bare strings would fail the build on HONEST copy:
  // the footer and PriceAlertCTA legitimately say "when the price
  // drops" (a true statement about shipped alerts), and /privacy
  // legitimately says "products you save" (wishlist saving). The false
  // claim is the NOUN form — an asserted event — so that is what is
  // banned, and the verb form is left alone.
  "/\bprice drop\b(?!s)/": "the NOUN form asserts an observed event: a markdown is the store's list price vs its current price from ONE feed row at one instant, and we did not watch the price fall. The verb form (\"when the price drops\") is a true statement about alerts and is deliberately NOT banned. Reserved for when two observations exist (§43).",
  "/you save\s*\$/": "asserts the visitor would otherwise have paid the list price. \"products you save\" (wishlist) is untouched (§43).",
  "/\bwas \$/": "asserts a price we observed earlier; we observed one instant. Say 'Marked down by the store' (§43).",
  // ABSENCE-AS-NEGATIVE-CLAIM (§46). original_price is NULL on 1,452 of
  // 1,453 rows because most partner feeds publish no list price — not
  // because those products are undiscounted. Any copy that treats a
  // missing list price as evidence of "not discounted" converts a
  // coverage gap into a claim about merchants. Both entries are REGEXES
  // for the same reason as the §43 three: the honest, qualified wordings
  // shipped alongside them use the same nouns.
  // REMOVE both when compare-at coverage is real (see §46's per-partner
  // table) — at that point the completeness claim becomes true and the
  // empty state becomes meaningful.
  "/no active deals/": "asserted that nothing is discounted when what we actually knew was that no feed published a list price (§46)",
  "/every real product currently (marked down|priced below)/": "a completeness claim over a field we hold for 1 product in 1,453; 'every product that is marked down' is unknowable from feeds that send no list price (§46)",
  "what it cost last month": "the /about claim the operator corrected on themselves: implied displayed price history before the charts exist (§26)",
  "how it has moved": "same /about claim, as originally worded in the shipped sentence (§26)",
  "refreshed daily": "displayed prices are static catalog prices (Option A gated); the daily job CHECKS them — 'refreshed' claimed the check updates the display (§27)",
  "best seller": "the Best Sellers pool was three July hand-typed badges on one partner; we hold no sales data — allowlist only when a measured popularity signal exists (§28)",
  "trending": "same claim as best seller: popularity nobody measured; the /trending ROUTE keeps its URL but no copy may assert trending-ness (§28)",
};

// Severity: NEVER APPEAR on any surface, any framing.
const NEVER_APPEAR = {
  subscribe: "the dead footer form — collected emails under a promise of alerts and discarded them (§23/§24); no editorial context redeems a string whose site history is a control that lied",
};

// Route-scoped exceptions for LEGITIMATE chrome uses (NEVER_ASSERT only —
// NEVER_APPEAR takes no exceptions by definition). Every entry needs a
// reason; an exception without a reason is how banned phrases leak back.
const ALLOWLIST = {
  // /categories marks empty taxonomy nodes "Coming soon" and says so in
  // its own intro copy — a stated policy about the taxonomy, not a false
  // capability claim. Caught by this check's first honest run, verified
  // true before being excepted.
  "categories.html": ["coming soon"],
};

if (!existsSync(APP_DIR)) {
  console.error(`FAIL: ${APP_DIR} not found — run after next build.`);
  process.exit(2);
}

const selftest = process.env.CLAIMS_CHECK_SELFTEST === "1";
const neverAssert = { ...NEVER_ASSERT };
const neverAppear = { ...NEVER_APPEAR };
if (selftest) {
  neverAssert["checked"] = "SELFTEST — present on chrome on purpose, this run MUST fail";
  neverAppear["memory"] = "SELFTEST — present in the first guide on purpose, this run MUST fail";
}

/** A key wrapped in /.../ is a REGEX; anything else is a substring.
 * Needed because some false claims differ from true ones only
 * grammatically — "price drop" (asserted event) vs "the price drops"
 * (what our alerts actually do). See §43. */
function matches(text, phrase) {
  if (phrase.length > 2 && phrase.startsWith("/") && phrase.endsWith("/")) {
    return new RegExp(phrase.slice(1, -1), "i").test(text);
  }
  return text.includes(phrase);
}

function extractText(file) {
  return readFileSync(file, "utf8")
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase();
}

const failures = [];
let control = 0;

// Site chrome: top-level routes, both severities.
const chromeFiles = readdirSync(APP_DIR).filter((f) => f.endsWith(".html"));
if (chromeFiles.length < 5) {
  console.error(`FAIL: only ${chromeFiles.length} top-level route(s) found — the build output looks wrong, not clean.`);
  process.exit(2);
}
for (const f of chromeFiles) {
  const text = extractText(join(APP_DIR, f));
  if (text.includes("go price finder")) control++;
  for (const [phrase, why] of Object.entries(neverAssert)) {
    if ((ALLOWLIST[f] ?? []).includes(phrase)) continue;
    if (matches(text, phrase)) failures.push(`${f}: NEVER_ASSERT "${phrase}" — ${why}`);
  }
  for (const [phrase, why] of Object.entries(neverAppear)) {
    if (text.includes(phrase)) failures.push(`${f}: NEVER_APPEAR "${phrase}" — ${why}`);
  }
}

// Guides: NEVER_APPEAR only (see header for why). Recurse guides/ so both
// the index and every [slug] page are covered — a route rendering outside
// the scan is a §19b gap by construction.
function* walkHtml(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkHtml(p);
    else if (entry.name.endsWith(".html")) yield p;
  }
}
let guideCount = 0;
for (const f of walkHtml(GUIDES_DIR)) {
  guideCount++;
  const text = extractText(f);
  if (text.includes("go price finder")) control++;
  const rel = f.replace(/\\/g, "/").split("/app/")[1];
  for (const [phrase, why] of Object.entries(neverAppear)) {
    if (text.includes(phrase)) failures.push(`${rel}: NEVER_APPEAR "${phrase}" — ${why}`);
  }
}

if (control === 0) {
  console.error("FAIL: no scanned route contains the site name — extraction is broken, and a broken extractor's clean result is worthless (§19).");
  process.exit(2);
}
console.log(
  `Scanned ${chromeFiles.length} chrome routes (both severities) + ${guideCount} guide page(s) (NEVER_APPEAR only; editorial prose is §23-reviewed at authoring). ${control} passed the site-name control.`
);
if (failures.length) {
  console.error("FAIL:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("PASS — no banned self-description phrases in rendered output.");
