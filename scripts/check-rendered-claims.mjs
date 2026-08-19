/**
 * Rendered-output claims tripwire (findings §23/§24). Permanent, not a
 * one-off, and the reason is the footer Subscribe form: an email field
 * whose submit handler was a deliberate no-op collected visitors' emails
 * under a promise of price alerts and discarded them, on every page — and
 * NO source-level review would have caught it, because the source looked
 * like a working form. Claims have to be checked where the visitor meets
 * them: in the rendered output.
 *
 * WHAT THIS IS: a string-level REGRESSION tripwire over the built HTML of
 * every site-owned route (top-level .next/server/app/*.html — partner
 * catalog pages live in subdirectories and render merchant-authored text,
 * which is not the site talking about itself). It bans the phrases every
 * confirmed-false self-description used, so none of them can quietly come
 * back. WHAT IT IS NOT: a semantic audit. A NEW false claim in fresh
 * wording passes this check — the full §23 method (extract every claim,
 * verify each against what the code does) remains session work whenever
 * self-description copy changes.
 *
 * Runs as package.json "postbuild": npm run build fails if a banned
 * phrase reappears. No credentials, no network.
 * SELFTEST: CLAIMS_CHECK_SELFTEST=1 bans a phrase that IS present
 * ("checked") — MUST exit nonzero.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP_DIR = ".next/server/app";
// Phrase -> why it is banned (every entry is a §23-confirmed falsehood).
const BANNED = {
  "data collection in progress": "the v2 placeholder that became its own false claim (§23)",
  "in development": "said of drop alerts long after they shipped (§23)",
  "coming soon": "said of price-history tracking while recording was already live (§23)",
  "checked weekly": "the cron has run daily since it existed (§23)",
  "checked every week": "same (§23)",
  "side by side": "cross-store same-product comparison does not exist yet (§23; remove from this list when it ships)",
  "best price": "described a badge that exists nowhere (§23; remove when the comparison surface ships)",
  "scan the whole market": "we search our own partner catalog, not the market (§23)",
  subscribe: "the dead footer form — collected emails and discarded them (§23/§24)",
  "tracking since launch": "the sparkline presented feed markdowns as observed price drops and claimed 'no changes yet' where changes were recorded (§25)",
};
// Route-scoped exceptions for LEGITIMATE uses: { "route.html": ["phrase"] }.
// Every entry needs a reason. An exception without a reason is how banned
// phrases leak back in.
const ALLOWLIST = {
  // /categories marks empty taxonomy nodes "Coming soon" and says so in
  // its own intro copy ("Categories with no products yet are marked
  // 'Coming soon' rather than hidden") — a stated policy about the
  // taxonomy, not a false capability claim. Caught by this check's first
  // honest run and verified true before being excepted.
  "categories.html": ["coming soon"],
};

if (!existsSync(APP_DIR)) {
  console.error(`FAIL: ${APP_DIR} not found — run after next build.`);
  process.exit(2);
}
const files = readdirSync(APP_DIR).filter((f) => f.endsWith(".html"));
if (files.length < 5) {
  console.error(`FAIL: only ${files.length} top-level route(s) found — the build output looks wrong, not clean.`);
  process.exit(2);
}

const banned = { ...BANNED };
if (process.env.CLAIMS_CHECK_SELFTEST === "1") banned["checked"] = "SELFTEST — present on purpose, this run MUST fail";

const failures = [];
let control = 0;
for (const f of files) {
  const html = readFileSync(join(APP_DIR, f), "utf8");
  const text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase();
  if (text.includes("go price finder")) control++;
  for (const [phrase, why] of Object.entries(banned)) {
    if ((ALLOWLIST[f] ?? []).includes(phrase)) continue;
    if (text.includes(phrase)) failures.push(`${f}: contains "${phrase}" — ${why}`);
  }
}
if (control === 0) {
  console.error("FAIL: no scanned route contains the site name — extraction is broken, and a broken extractor's clean result is worthless (§19).");
  process.exit(2);
}
console.log(`Scanned ${files.length} site-owned routes (${control} passed the site-name control).`);
if (failures.length) {
  console.error("FAIL:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("PASS — no banned self-description phrases in rendered output.");
