#!/usr/bin/env node
/**
 * MIGRATION-DRIFT GATE (findings §57).
 *
 * THE FAILURE IT EXISTS FOR: eight migrations — 0015 through 0022, plus
 * three unnumbered ones nobody had noticed — were applied through the
 * Supabase MCP tool and never written into supabase/migrations/. The repo
 * could not rebuild the schema it depends on. Code referencing gtin,
 * refresh_runs, feed_status and the aaawave enum would fail against a
 * repo-reconstructed database, and nobody discovers that until they are
 * already in trouble.
 *
 * WHY IDENTITIES AND NOT COUNTS. The brief asked for a count comparison.
 * A count is the weaker check twice over: it passes if someone adds a
 * file with the wrong name, and it FAILS FOREVER here for a legitimate
 * reason — 0001, 0002 and 0003 predate migration tracking and have no
 * applied record, so file-count will never equal applied-count on this
 * project. Comparing names catches the real thing and tolerates the real
 * exception.
 *
 * WHY A MANIFEST AND NOT A LIVE QUERY. `supabase_migrations` is not
 * exposed through PostgREST, and the build has no direct Postgres
 * connection — deliberately: the least-privilege `migration_auditor` role
 * created for exactly this check (see
 * 0014a_add_migration_auditor_role.sql) has its password set by a human
 * and held in GitHub Actions secrets, never in a build environment.
 *
 * So the check is split, and the two halves compose transitively:
 *   THIS GATE (every build, no credential): files == manifest.
 *   CI GATE (needs the auditor credential): manifest == database.
 * Together: files == database. Running only this half would be circular
 * — a manifest that is never re-derived from the database can drift with
 * the directory it describes — which is why the CI half is not optional
 * and is called out in the failure message.
 *
 * Regenerate the manifest whenever a migration is applied. It comes from
 * the database, never from memory.
 *
 * SELFTEST: MIGRATION_DRIFT_SELFTEST=1 pretends one extra migration was
 * applied. MUST exit nonzero.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = join("supabase", "migrations");
const MANIFEST = join("supabase", "applied-migrations.json");

/** Files that legitimately have no applied record, each with a reason.
 * These predate supabase_migrations tracking on this project. */
const PRE_TRACKING_BASELINE = {
  "0001_initial_schema": "the initial schema, applied before migration tracking existed",
  "0002_add_username": "applied before migration tracking existed",
  "0003_add_target_price": "applied before migration tracking existed",
};

if (!existsSync(MANIFEST)) {
  console.error(`FAIL: ${MANIFEST} not found. It is the record of what the DATABASE has applied; without it this gate would be comparing the repo against itself.`);
  process.exit(2);
}
if (!existsSync(DIR)) {
  console.error(`FAIL: ${DIR} not found.`);
  process.exit(2);
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const applied = manifest.applied ?? [];
if (!Array.isArray(applied) || applied.length === 0) {
  console.error("FAIL: manifest lists no applied migrations — a broken manifest's clean result is worthless (§19).");
  process.exit(2);
}
if (manifest.count !== applied.length) {
  console.error(`FAIL: manifest is internally inconsistent — count ${manifest.count} vs ${applied.length} entries.`);
  process.exit(2);
}

if (process.env.MIGRATION_DRIFT_SELFTEST === "1") {
  applied.push({ version: "99999999999999", name: "0099_selftest_never_committed" });
}

/** Strip a leading NNNN or NNNNa migration number from either side so a
 * file named 0015_price_history_provenance.sql matches an applied
 * migration named either "0015_price_history_provenance" or
 * "price_history_provenance". Both conventions are present. */
const normalize = (s) => s.replace(/\.sql$/, "").replace(/^\d{4}[a-z]?_/, "");

const files = readdirSync(DIR).filter((f) => f.endsWith(".sql"));
const byNormalized = new Map(files.map((f) => [normalize(f), f]));

const missing = [];
for (const m of applied) {
  if (!byNormalized.has(normalize(m.name))) {
    missing.push(`${m.version}  ${m.name} — APPLIED to the database, but no file in ${DIR}/`);
  }
}

const appliedNormalized = new Set(applied.map((m) => normalize(m.name)));
const unexplained = [];
for (const f of files) {
  const n = normalize(f);
  if (appliedNormalized.has(n)) continue;
  if (PRE_TRACKING_BASELINE[f.replace(/\.sql$/, "")]) continue;
  unexplained.push(`${f} — a file with no applied record, and not in PRE_TRACKING_BASELINE`);
}

console.log(
  `Checked ${files.length} files in ${DIR}/ against ${applied.length} applied migrations ` +
    `(${Object.keys(PRE_TRACKING_BASELINE).length} pre-tracking baseline files excused).`
);

if (missing.length || unexplained.length) {
  console.error("\nFAIL — the repo cannot rebuild the database's schema:");
  for (const m of missing) console.error("  - " + m);
  for (const u of unexplained) console.error("  - " + u);
  console.error(
    "\nRecover applied text with:  node --env-file=.env.local scripts/_recover-migrations.mjs <name>\n" +
      "Supabase retains the full statement text, comments included, so recovery is exact rather than regenerated.\n" +
      "NOTE: this gate compares files against the MANIFEST. If a migration was applied and the manifest\n" +
      "was never regenerated, this passes while the repo is still behind — the CI half (manifest vs live\n" +
      "database, using the migration_auditor role) is what closes that gap."
  );
  process.exit(1);
}
console.log("PASS — every applied migration has a file, and every file is accounted for.");
