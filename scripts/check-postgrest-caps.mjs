/**
 * §17 as a test: PostgREST caps every response at max-rows (1,000 on this
 * project) and returns 200 on the truncated result — a read that silently
 * returns 1,000 rows is indistinguishable from a table that has 1,000
 * rows. This check exists so the findings doc's audit table cannot rot:
 * it re-derives the audit from the code and the live database on every
 * run (findings §16–§18).
 *
 * WHAT IT DOES
 *  1. Scans lib/, app/, components/, scripts/ for every `.from("table")`
 *     call chain and classifies each: write (insert/upsert/update/delete),
 *     count-only (head: true — computed server-side, cap-immune), bounded
 *     (.single/.maybeSingle/.limit/.range), or UNBOUNDED (a .select with
 *     none of those).
 *  2. Every UNBOUNDED site must have an entry in
 *     scripts/postgrest-cap-registry.json giving the reason it is safe.
 *     A NEW unbounded read added anywhere later fails the check until it
 *     is either paged (use lib/supabase/fetchAllRows.ts) or registered
 *     with a defensible reason. A registry entry whose site no longer
 *     exists also fails — the registry cannot drift from the code in
 *     either direction (same bidirectional pattern as
 *     check-build-queries.mjs's derived expectation).
 *  3. Every `watch` entry in the registry runs a live
 *     `count: exact, head: true` against the table and FAILS when the
 *     count exceeds maxRows (thresholds set at 80% of the cap, so the
 *     check reddens before truncation begins, not after).
 *
 * KNOWN LIMITS (stated, not hidden)
 *  - A single-shot `.range(0, 999)` with no loop scans as "bounded" —
 *    the scanner cannot see loops. Use fetchAllRows() so this cannot
 *    happen by accident; hand-rolled .range() needs review.
 *  - The scanner is regex-grade, not a TS parser. It reads each chain
 *    from `.from(` to the statement-ending `;` at depth 0.
 *
 * RUN:      node --env-file=.env.local scripts/check-postgrest-caps.mjs
 * SELFTEST: CAP_CHECK_SELFTEST=1 node --env-file=.env.local scripts/check-postgrest-caps.mjs
 *           (forces every watch threshold to -1: MUST exit nonzero —
 *           proves the failure path executes; an instrument that cannot
 *           fail is not an instrument)
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (counts must see all rows through
 * RLS). Exits 2 if the environment is missing — an instrument that
 * silently skips its measurement is the original sin this suite exists
 * to end.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SCAN_DIRS = ["lib", "app", "components", "scripts"];
const EXCLUDE_DIRS = new Set(["node_modules", ".next", "scratch"]);
const FILE_RE = /\.(ts|tsx|mjs)$/;
const REGISTRY_PATH = "scripts/postgrest-cap-registry.json";

// --- 1. Scan ---------------------------------------------------------

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (FILE_RE.test(entry)) yield p;
  }
}

/** Capture the call chain from `.from(` to the first `;` at depth <= 0. */
function captureChain(src, fromIdx) {
  let depth = 0;
  for (let i = fromIdx; i < Math.min(src.length, fromIdx + 4000); i++) {
    const ch = src[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === ";" && depth <= 0) return src.slice(fromIdx, i);
  }
  return src.slice(fromIdx, fromIdx + 4000);
}

function classify(chain) {
  if (/\.(insert|upsert|update|delete)\(/.test(chain)) return "write";
  if (/head:\s*true/.test(chain)) return "count-only";
  if (/\.(single|maybeSingle|limit|range)\(/.test(chain)) return "bounded";
  if (/\.select\(/.test(chain)) return "UNBOUNDED";
  return "other";
}

const sites = [];
for (const file of SCAN_DIRS.flatMap((d) => [...walk(d)])) {
  const src = readFileSync(file, "utf8");
  const re = /\.from\(\s*["']([a-z_]+)["']\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const chain = captureChain(src, m.index);
    const line = src.slice(0, m.index).split("\n").length;
    sites.push({
      file: relative(".", file).replace(/\\/g, "/"),
      table: m[1],
      line,
      kind: classify(chain),
    });
  }
}

// Occurrence index among UNBOUNDED sites of the same (file, table) — the
// registry key survives line-number churn but not reordering, which is
// the acceptable trade (reordering unbounded reads of the same table in
// one file is rare and the failure is loud, not silent).
const unbounded = [];
const perFileTable = new Map();
for (const s of sites) {
  if (s.kind !== "UNBOUNDED") continue;
  const k = `${s.file}::${s.table}`;
  const n = perFileTable.get(k) ?? 0;
  perFileTable.set(k, n + 1);
  unbounded.push({ ...s, key: `${k}::${n}` });
}

// --- 2. Registry reconciliation --------------------------------------

const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
const failures = [];

for (const s of unbounded) {
  if (!registry.sites[s.key]) {
    failures.push(
      `NEW UNBOUNDED READ: ${s.file}:${s.line} reads "${s.table}" with no .range()/.limit()/.single() and no head:true count.\n` +
        `  Either page it with lib/supabase/fetchAllRows.ts, or register "${s.key}" in ${REGISTRY_PATH} with the reason it cannot cross 1,000 rows.`
    );
  }
}
for (const key of Object.keys(registry.sites)) {
  if (!unbounded.some((s) => s.key === key)) {
    failures.push(
      `STALE REGISTRY ENTRY: "${key}" is registered but no longer found in the code — remove it or fix the scan.`
    );
  }
}

// --- 3. Live counts vs thresholds -------------------------------------

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "FAIL (env): NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — the live-count half of this check cannot run, and skipping it silently is the exact failure family it exists to catch."
  );
  process.exit(2);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });
const selftest = process.env.CAP_CHECK_SELFTEST === "1";

console.log("Unbounded-read sites (each requires a registry reason):");
for (const s of unbounded) {
  const reg = registry.sites[s.key];
  console.log(`  ${s.key} @ line ${s.line} — ${reg ? reg.reason : "*** UNREGISTERED ***"}`);
}

console.log(selftest ? "\nWatches (SELFTEST: thresholds forced to -1, every row-bearing table MUST fail):" : "\nWatches (live count vs threshold; cap is 1,000):");
const rows = [["label", "table", "count", "maxRows", "status"]];
for (const [label, w] of Object.entries(registry.watch)) {
  const maxRows = selftest ? -1 : w.maxRows;
  const { count, error } = await supabase
    .from(w.table)
    .select("*", { count: "exact", head: true });
  if (error || count === null) {
    failures.push(`WATCH "${label}": count failed — ${error?.message ?? "null count"} (unknown is not zero)`);
    rows.push([label, w.table, "ERR", String(maxRows), "FAIL"]);
    continue;
  }
  const over = count > maxRows;
  if (over)
    failures.push(
      `WATCH "${label}": ${w.table} has ${count} rows, threshold ${maxRows}. ${w.onCross}`
    );
  rows.push([label, w.table, String(count), String(maxRows), over ? "FAIL" : "ok"]);
}
const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
for (const r of rows) console.log("  " + r.map((c, i) => c.padEnd(widths[i])).join("  "));

// --- 4. Verdict --------------------------------------------------------

const kinds = { write: 0, "count-only": 0, bounded: 0, UNBOUNDED: 0, other: 0 };
for (const s of sites) kinds[s.kind]++;
console.log(
  `\nScanned ${sites.length} .from() sites: ${kinds.write} writes, ${kinds["count-only"]} count-only, ${kinds.bounded} bounded, ${kinds.UNBOUNDED} unbounded-registered, ${kinds.other} other.`
);

if (failures.length > 0) {
  console.error("\nFAIL:\n" + failures.map((f) => "- " + f).join("\n"));
  process.exit(1);
}
console.log("PASS");
