#!/usr/bin/env node
/**
 * HAND-ENUMERATION COVERAGE GATE (findings §48).
 *
 * THE RULE THIS ENFORCES: a check that enumerates by hand is a check
 * with an expiry date nobody wrote down.
 *
 * It came from a real miss. `check-contrast.mjs` listed its routes by
 * hand, including exactly one guide. Publishing a second guide put a
 * whole live route outside the contrast gate while the gate reported
 * PASS on eleven routes — invisible by construction, because the thing
 * that stopped being covered was the thing nobody had added to the list.
 * When that checker was converted to enumerate the build output, it went
 * from 12 routes to 29 and immediately found a real 1.45:1 failure that
 * had been live on every multi-image product page.
 *
 * Most instruments in this repo already walk directories or iterate
 * PARTNERS. The two lists below cannot be derived — they carry editorial
 * or policy judgement — so instead of converting them, this asserts they
 * are COMPLETE. A new page or a new source directory now fails the build
 * loudly rather than being quietly uncovered.
 *
 * Runs as part of `postbuild`, so it blocks — it needs the RENDERED
 * sitemap, which only exists after a build.
 *
 * SELFTEST: HAND_ENUM_SELFTEST=1 pretends a route named
 * `/__selftest-missing` exists in the app tree. That route is in no
 * list, so this run MUST exit nonzero. Proves the gate can fail before
 * its passing is trusted (standing rule 5b).
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const selftest = process.env.HAND_ENUM_SELFTEST === "1";
const failures = [];

// ---------------------------------------------------------------------
// 1. Every static top-level route in app/ is either in the sitemap or
//    deliberately excluded from it.
// ---------------------------------------------------------------------

/** Deliberately NOT in the sitemap, each with a reason. This list is
 * itself hand-written — but it is a list of DECISIONS, which is the kind
 * of list a human should maintain, and adding a page you forget about
 * now fails the build instead of vanishing. */
const SITEMAP_EXCLUSIONS = {
  "/search": "a search UI with no indexable content of its own; results are per-query",
  "/wishlist": "per-visitor saved items behind auth — nothing stable to index",
};

function staticAppRoutes() {
  const out = [];
  const walk = (dir, prefix) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      // Dynamic segments, route groups, and non-page trees.
      if (name.startsWith("[") || name.startsWith("(") || name.startsWith("_")) continue;
      if (name === "api" || name === "auth") continue;
      const full = join(dir, name);
      if (existsSync(join(full, "page.tsx"))) out.push(`${prefix}/${name}`);
      walk(full, `${prefix}/${name}`);
    }
  };
  if (existsSync(join("app", "page.tsx"))) out.push("/");
  walk("app", "");
  return [...new Set(out)].sort();
}

// Compare against the RENDERED sitemap, not against sitemap.ts's source.
// The first version of this gate grepped the source for `${SITE_URL}/route`
// and reported all seven partner pages as missing — they are emitted by a
// getPartners() mapper, and every one of them is in the real output. A
// check that reads intent instead of output invents its own failures;
// this reads what the build actually produced.
const RENDERED_SITEMAP = ".next/server/app/sitemap.xml.body";
if (!existsSync(RENDERED_SITEMAP)) {
  console.error(
    `FAIL: ${RENDERED_SITEMAP} not found. This gate compares app routes against the RENDERED sitemap, ` +
      `so without a build there is nothing to compare and a PASS would be vacuous. Runs as postbuild.`
  );
  process.exit(2);
}
const sitemapXml = readFileSync(RENDERED_SITEMAP, "utf8");
const sitemapLocs = new Set(
  [...sitemapXml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, "") || "/")
);
if (sitemapLocs.size < 20) {
  console.error(`FAIL: rendered sitemap has only ${sitemapLocs.size} urls — the parse or the build is wrong, not the site.`);
  process.exit(2);
}

const appRoutes = staticAppRoutes();
if (selftest) appRoutes.push("/__selftest-missing");

if (appRoutes.length < 10) {
  console.error(`FAIL: only ${appRoutes.length} static routes found in app/ — the walker is broken, and a broken walker's clean result is worthless (§19).`);
  process.exit(2);
}

for (const route of appRoutes) {
  if (SITEMAP_EXCLUSIONS[route]) continue;
  if (!sitemapLocs.has(route)) {
    failures.push(`app${route === "/" ? "" : route}/page.tsx renders a real route, but it is absent from the rendered sitemap. Add it in app/sitemap.ts, or to SITEMAP_EXCLUSIONS here with a reason.`);
  }
}

// ---------------------------------------------------------------------
// 2. Every top-level directory holding source is scanned by the
//    unbounded-read audit.
// ---------------------------------------------------------------------

const capsSrc = readFileSync(join("scripts", "check-postgrest-caps.mjs"), "utf8");
const scanDirsMatch = /const SCAN_DIRS = \[([^\]]*)\]/.exec(capsSrc);
if (!scanDirsMatch) {
  console.error("FAIL: could not find SCAN_DIRS in check-postgrest-caps.mjs — this gate is reading the wrong shape and cannot be trusted.");
  process.exit(2);
}
const scanDirs = [...scanDirsMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

/** Top-level directories we never want scanned, with reasons. */
const NOT_SOURCE = {
  node_modules: "dependencies", ".next": "build output", ".git": "vcs",
  public: "static assets", content: "markdown, no code", claude: "documentation",
  scratch: "throwaway one-offs, deliberately unaudited", supabase: "migrations, not app reads",
  _to_delete: "staged for removal", types: "type declarations only",
};

function hasSource(dir) {
  let found = false;
  const walk = (d, depth) => {
    if (found || depth > 3) return;
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (found) return;
      if (e.isDirectory()) { if (!e.name.startsWith(".")) walk(join(d, e.name), depth + 1); }
      else if (/\.(ts|tsx|mjs)$/.test(e.name)) found = true;
    }
  };
  walk(dir, 0);
  return found;
}

for (const entry of readdirSync(".", { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const name = entry.name;
  if (name.startsWith(".") || NOT_SOURCE[name] || scanDirs.includes(name)) continue;
  if (hasSource(name)) {
    failures.push(`Top-level directory "${name}/" contains source but is not in check-postgrest-caps.mjs's SCAN_DIRS. Unbounded reads there would go unaudited. Add it to SCAN_DIRS, or to NOT_SOURCE here with a reason.`);
  }
}

// ---------------------------------------------------------------------

console.log(
  `Checked ${appRoutes.length} static app routes against ${sitemapLocs.size} rendered sitemap urls (${Object.keys(SITEMAP_EXCLUSIONS).length} deliberate exclusions) ` +
    `and every top-level source directory against SCAN_DIRS [${scanDirs.join(", ")}].`
);

if (failures.length) {
  console.error("FAIL — a hand-written list has fallen behind the thing it enumerates:\n" + failures.map((f) => "- " + f).join("\n"));
  process.exit(1);
}
console.log("PASS — no hand-written enumeration has fallen behind.");
