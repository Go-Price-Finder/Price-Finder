#!/usr/bin/env node
/**
 * Verify that each repo migration's EXECUTABLE SQL matches what the
 * database actually applied (findings §57). Comments are free to differ —
 * the authored files carry reasoning that was never sent to Postgres —
 * but a single differing statement means the file is wrong.
 *
 * The stripper is deliberately not a line-based `--` filter. Migration
 * 0023's own column comment CONTAINS the text "-- never fall back to the
 * catalog vintage", inside a single-quoted string. A naive strip would
 * truncate that statement and then report a mismatch it had caused
 * itself. It also handles '' escaping and $$ dollar-quoting (0014a uses
 * a DO $$ block).
 *
 * Usage: node scripts/_verify-migration-sql.mjs <applied.b64>
 * where the file holds base64 of  name \x01 sql  records joined by \x02.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function stripSqlComments(sql) {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const two = sql.slice(i, i + 2);
    // single-quoted string: copy verbatim, '' is an escaped quote
    if (sql[i] === "'") {
      out += sql[i++];
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") { out += "''"; i += 2; continue; }
        if (sql[i] === "'") { out += sql[i++]; break; }
        out += sql[i++];
      }
      continue;
    }
    // dollar-quoted block: copy verbatim to the matching tag
    const dollar = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
    if (dollar) {
      const tag = dollar[0];
      const end = sql.indexOf(tag, i + tag.length);
      const stop = end === -1 ? sql.length : end + tag.length;
      out += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (two === "--") { while (i < sql.length && sql[i] !== "\n") i++; continue; }
    if (two === "/*") { const e = sql.indexOf("*/", i); i = e === -1 ? sql.length : e + 2; continue; }
    out += sql[i++];
  }
  return out;
}

const normalize = (sql) => stripSqlComments(sql).replace(/\s+/g, " ").trim();

const b64 = readFileSync(process.argv[2], "utf8").trim();
const decoded = Buffer.from(b64, "base64").toString("utf8");
const records = decoded.split("").filter(Boolean);

let ok = 0, bad = 0, missing = 0;
for (const rec of records) {
  const idx = rec.indexOf("");
  const name = rec.slice(0, idx);
  const appliedSql = rec.slice(idx + 1);
  const file = join("supabase", "migrations", `${name}.sql`);
  if (!existsSync(file)) { console.log(`  ${name.padEnd(42)} NO FILE`); missing++; continue; }
  const fileSql = readFileSync(file, "utf8");

  const a = normalize(appliedSql);
  const f = normalize(fileSql);
  if (a === f) {
    console.log(`  ${name.padEnd(42)} SQL IDENTICAL  (${a.length} normalized chars)`);
    ok++;
  } else {
    bad++;
    console.log(`  ${name.padEnd(42)} *** SQL DIVERGES ***`);
    console.log(`      applied: ${a.length} chars | file: ${f.length} chars`);
    // first difference, with context
    let p = 0;
    while (p < a.length && p < f.length && a[p] === f[p]) p++;
    console.log(`      first difference at char ${p}:`);
    console.log(`        applied …${a.slice(Math.max(0, p - 50), p + 60)}`);
    console.log(`        file    …${f.slice(Math.max(0, p - 50), p + 60)}`);
  }
}
console.log(`\nidentical ${ok}, diverging ${bad}, missing ${missing}`);
process.exit(bad || missing ? 1 : 0);
