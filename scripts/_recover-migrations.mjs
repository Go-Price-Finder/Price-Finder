#!/usr/bin/env node
/**
 * Recover applied migration text from supabase_migrations.schema_migrations
 * into supabase/migrations/ (findings §57).
 *
 * WHY A SCRIPT AND NOT COPY-PASTE: the defect being repaired is that the
 * repo does not match the database. Retyping SQL from a query result into
 * a file re-introduces exactly the divergence at a smaller scale, and a
 * single mistyped character in a migration is invisible until someone
 * rebuilds from the repo. These bytes come out of the database and go
 * straight to disk untouched.
 *
 * Supabase retains the FULL statement text — comments included — in the
 * `statements` array, so this recovers what was actually applied rather
 * than DDL regenerated from the live schema. Regeneration would produce a
 * file that yields the same schema while losing every comment and every
 * stated reason, which on this project is most of the value.
 *
 * Usage:
 *   node --env-file=.env.local scripts/_recover-migrations.mjs <name> [<name>...]
 *   node --env-file=.env.local scripts/_recover-migrations.mjs --list
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing Supabase env — run with --env-file=.env.local"); process.exit(1); }
const supabase = createClient(url, key, { auth: { persistSession: false }, db: { schema: "supabase_migrations" } });

const args = process.argv.slice(2);
const { data, error } = await supabase.from("schema_migrations").select("version, name, statements").order("version");
if (error) { console.error("read failed:", error.message); process.exit(2); }

if (args.includes("--list") || args.length === 0) {
  for (const r of data) {
    const bytes = (r.statements ?? []).join("\n").length;
    console.log(`${r.version}  ${String(r.name).padEnd(45)} ${String(bytes).padStart(6)} bytes`);
  }
  console.log(`\n${data.length} applied migrations. Pass names to write them into supabase/migrations/.`);
  process.exit(0);
}

const OUT = join("supabase", "migrations");
let written = 0;
for (const name of args) {
  const row = data.find((r) => r.name === name);
  if (!row) { console.error(`  NOT APPLIED: ${name}`); continue; }
  const sql = (row.statements ?? []).join("\n");
  if (!sql.trim()) { console.error(`  EMPTY statements for ${name} — cannot recover, regenerate instead`); continue; }
  const file = join(OUT, `${name}.sql`);
  if (existsSync(file)) { console.error(`  EXISTS, refusing to overwrite: ${file}`); continue; }
  // Trailing newline so the file is POSIX-clean; the recovered text itself
  // is written byte-for-byte otherwise.
  writeFileSync(file, sql.endsWith("\n") ? sql : sql + "\n", "utf8");
  console.log(`  wrote ${file} (${sql.length} bytes recovered, version ${row.version})`);
  written++;
}
console.log(`\n${written} file(s) written.`);
