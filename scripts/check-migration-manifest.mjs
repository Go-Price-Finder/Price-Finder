#!/usr/bin/env node
/**
 * THE CI HALF of the migration-drift check (findings §57/§58).
 *
 * The build asserts  files == manifest  (scripts/check-migration-drift.mjs).
 * THIS asserts       manifest == database.
 * Together they compose into the property we actually want — the repo can
 * rebuild the schema — which neither half proves alone. Run the build half
 * without this one and the check is circular: a manifest that is never
 * re-derived from the database drifts happily alongside the directory it
 * claims to describe.
 *
 * CREDENTIAL. Uses the least-privilege `migration_auditor` role created by
 * 0014a_add_migration_auditor_role.sql — SELECT on exactly
 * supabase_migrations.schema_migrations, revoked from everything else, with
 * a password set by a human and held in GitHub Actions secrets. That role
 * has existed since 2026-08-15 FOR THIS CHECK, which was never built. It is
 * deliberately unavailable to AI sessions and to the Vercel build, which is
 * why this cannot live in `npm run build`.
 *
 * A MISSING CREDENTIAL IS A FAILURE, NOT A SKIP. A check that quietly
 * passes when it cannot run is worse than no check — it reports coverage it
 * does not have (§19, and rule 5g). If MIGRATION_AUDITOR_URL is unset this
 * exits 2 and says so.
 *
 * Usage: MIGRATION_AUDITOR_URL=postgres://... node scripts/check-migration-manifest.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

/** Pure comparison, extracted so it is testable without a database.
 * SELFTEST below exercises it directly. */
export function compareManifest(applied, manifest) {
  const failures = [];
  const dbByVersion = new Map(applied.map((m) => [String(m.version), m.name]));
  const mfByVersion = new Map((manifest.applied ?? []).map((m) => [String(m.version), m.name]));

  for (const [version, name] of dbByVersion) {
    if (!mfByVersion.has(version)) {
      failures.push(`APPLIED but absent from the manifest: ${version} ${name} — the manifest was not regenerated after this migration was applied.`);
    } else if (mfByVersion.get(version) !== name) {
      failures.push(`NAME MISMATCH at ${version}: database says "${name}", manifest says "${mfByVersion.get(version)}".`);
    }
  }
  for (const [version, name] of mfByVersion) {
    if (!dbByVersion.has(version)) {
      failures.push(`IN THE MANIFEST but NOT APPLIED: ${version} ${name} — the manifest claims a migration the database has never run.`);
    }
  }
  if (manifest.count !== (manifest.applied ?? []).length) {
    failures.push(`manifest is internally inconsistent: count ${manifest.count} vs ${(manifest.applied ?? []).length} entries.`);
  }
  return failures;
}

if (process.env.MIGRATION_MANIFEST_SELFTEST === "1") {
  // Exercises all FOUR failure modes at once. The expected count was
  // wrong on the first run — the original fixture was internally
  // consistent, so the count check correctly stayed silent and the
  // selftest failed itself. Left as a fixture that triggers each mode
  // exactly once, so the number 4 is derived from the cases and not
  // guessed.
  const f = compareManifest(
    [
      { version: "1", name: "same" },          // ok
      { version: "2", name: "applied-only" },  // -> absent from manifest
      { version: "3", name: "db-name" },       // -> name mismatch
    ],
    {
      count: 99,                               // -> internally inconsistent
      applied: [
        { version: "1", name: "same" },
        { version: "3", name: "manifest-name" },
        { version: "4", name: "manifest-only" }, // -> in manifest, not applied
      ],
    }
  );
  console.log("SELFTEST failures (" + f.length + ", expected 4):");
  for (const x of f) console.log("  - " + x);
  process.exit(f.length === 4 ? 0 : 1);
}

const url = process.env.MIGRATION_AUDITOR_URL;
if (!url) {
  console.error(
    "FAIL: MIGRATION_AUDITOR_URL is not set. This check compares the manifest against the LIVE database;\n" +
      "without the credential it cannot run, and a check that passes when it cannot run reports coverage it\n" +
      "does not have. Set the secret to the migration_auditor connection string (see\n" +
      "supabase/migrations/0014a_add_migration_auditor_role.sql)."
  );
  process.exit(2);
}

const manifest = JSON.parse(readFileSync(join("supabase", "applied-migrations.json"), "utf8"));

const client = new pg.Client({ connectionString: url });
await client.connect();
const { rows } = await client.query(
  "select version, name from supabase_migrations.schema_migrations order by version"
);
await client.end();

if (rows.length === 0) {
  console.error("FAIL: the database reported zero applied migrations — that is not a clean result, it is a broken read (§19).");
  process.exit(2);
}

const failures = compareManifest(rows, manifest);
console.log(`Compared ${rows.length} applied migrations against ${manifest.applied.length} manifest entries.`);

if (failures.length) {
  console.error("\nFAIL — the manifest no longer matches the database:\n" + failures.map((f) => "  - " + f).join("\n"));
  console.error(
    "\nRegenerate the manifest from the database, never from memory, and commit it with the migration file.\n" +
      "See standing rule 5h: a migration lands in the repo FIRST and is applied SECOND."
  );
  process.exit(1);
}
console.log("PASS — the manifest matches the database exactly.");
