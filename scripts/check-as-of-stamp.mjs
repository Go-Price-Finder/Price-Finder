#!/usr/bin/env node
/**
 * AS-OF STAMP GATE (findings §76). Runs in `prebuild`.
 *
 * Exists because of a defect that shipped and survived a month: the stamp
 * fell back to FEED_VINTAGE, a hand-maintained date literal, so ~298
 * products rendered "Price as of Jul 25, 2026" while their feeds had
 * exported that morning. The date was the mtime of a source file
 * presented as a merchant fact.
 *
 * Three jobs, in increasing order of what they can catch:
 *
 *  1. FIXTURES — resolveAsOfStamp has exactly one source of truth.
 *  2. SOURCE TRIPWIRE — no date literal may reappear in the modules that
 *     decide the stamp. A fallback always looks like a date in a file.
 *  3. TRIPWIRE SELF-TEST — the tripwire is fed a string it MUST reject,
 *     because a tripwire nobody has seen fail is not known to work (§44).
 */
import { readFileSync } from "node:fs";
import { resolveAsOfStamp } from "../components/PriceAsOfLabel.tsx";

const failures = [];
const check = (name, cond, detail = "") => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name} ${detail}`); failures.push(name); }
};

console.log("FIXTURES — resolveAsOfStamp");

const P = { partnerId: "tsar-bomba", slug: "elemental-series-automatic-watch-tb8207a-black" };

check("a real feed vintage produces a stamp",
  resolveAsOfStamp({ ...P, priceSource: "live", priceFeedVintage: "2026-08-12T06:45:42Z" })?.iso === "2026-08-12");

check("NO vintage produces NO stamp, even on the live path",
  resolveAsOfStamp({ ...P, priceSource: "live", priceFeedVintage: null }) === null);

// THE REGRESSION ITSELF. This is the exact call the ~298 products made.
check("NO vintage on the CATALOG path produces NO stamp (the §76 defect)",
  resolveAsOfStamp({ ...P, priceSource: "catalog", priceFeedVintage: null }) === null);

check("a bare product with neither field produces NO stamp",
  resolveAsOfStamp(P) === null);

check("partnerId/slug alone can never conjure a date",
  resolveAsOfStamp({ partnerId: "canvas-vows", slug: "american-flag-canvas" }) === null);

// A vintage is honoured regardless of how priceSource is labelled — the
// vintage travels WITH the value (§63), so the label is not the authority.
check("a vintage is honoured even when priceSource says catalog",
  resolveAsOfStamp({ ...P, priceSource: "catalog", priceFeedVintage: "2026-08-01T00:00:00Z" })?.iso === "2026-08-01");

console.log("\nSOURCE TRIPWIRE — no date literal may decide a stamp");

// A fallback vintage table cannot be written without a date literal in
// one of these files. Watching for the literal catches the reintroduction
// in whatever shape it takes — a Record, a switch, a single default.
const WATCHED = ["lib/price-as-of.ts", "components/PriceAsOfLabel.tsx"];
const DATE_LITERAL = /["'`]\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?["'`]/;

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

for (const f of WATCHED) {
  const code = stripComments(readFileSync(f, "utf8"));
  const hit = code.match(DATE_LITERAL);
  check(`${f} contains no date literal in code`, !hit, hit ? `found ${hit[0]}` : "");
}

console.log("\nTRIPWIRE SELF-TEST — prove it can fail");

const mustCatch = [
  `const FEED_VINTAGE = { "awin:103552": "2026-05-15" };`,
  `const fallback = "2026-07-25";`,
  `return { iso: '2026-08-02', label: AS_OF_LABEL };`,
];
const mustNotCatch = [
  `return product.priceFeedVintage ? { iso: product.priceFeedVintage.slice(0, 10) } : null;`,
  `const AS_OF_LABEL = "Price as of";`,
];
for (const s of mustCatch) check(`tripwire REJECTS: ${s.slice(0, 46)}…`, DATE_LITERAL.test(stripComments(s)));
for (const s of mustNotCatch) check(`tripwire ACCEPTS: ${s.slice(0, 46)}…`, !DATE_LITERAL.test(stripComments(s)));

// The doc comments in these files deliberately QUOTE the deleted dates so
// the incident stays readable. If comment-stripping ever breaks, the
// tripwire would fire on its own documentation and look like a real
// regression — assert that the stripper is actually doing something.
const rawHasDate = DATE_LITERAL.test(readFileSync("lib/price-as-of.ts", "utf8"));
check("comment-stripping is load-bearing (raw file DOES contain a quoted date)", rawHasDate,
  "if this fails, the tripwire is passing for the wrong reason");

console.log(`\nas-of stamp: ${failures.length === 0 ? "ALL PASS" : failures.length + " FAILED"}`);
if (failures.length) process.exit(1);
