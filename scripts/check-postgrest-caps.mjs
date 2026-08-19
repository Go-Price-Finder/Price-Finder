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
 * RANGE RULE (operator ruling, closes the single-shot-.range hole): a
 * `.range()` call site is only auto-classified as paged when it is the
 * fetchAllRows helper itself or a visible fetchAllRows(...) call site.
 * Any OTHER .range() — the hand-rolled kind, where someone reaches for
 * .range to "handle" paging and stops after one call — must be
 * registered with a reason proving the loop. fetchAllRows is the only
 * place .range appears without a written justification.
 *
 * KNOWN LIMITS (stated, not hidden)
 *  - A registered hand-rolled .range() is trusted on its written reason;
 *    the scanner still cannot verify the loop itself.
 *  - The scanner is regex-grade, not a TS parser. It reads each chain
 *    from `.from(` to the statement-ending `;` at depth 0.
 *
 * MODES (where this runs — rule 2 requires the answer to be "always"):
 *  (default)     static scan + live watches; exits 2 if credentials are
 *                missing. The full local gate run.
 *  --static      static scan only (classification + registry drift).
 *                No credentials, no network. Runs anywhere.
 *  --build-gate  static scan ALWAYS (blocking); live watches too when
 *                credentials are present, with one retry on transient
 *                errors — a watch breach or count failure FAILS the
 *                build. When credentials are absent it prints a loud
 *                skip line and passes on the static half alone (the
 *                static half is never gated behind the credentialed
 *                half). Wired as package.json "prebuild", so `npm run
 *                build` — local and Vercel — cannot complete without it.
 *
 * RUN:      node --env-file=.env.local scripts/check-postgrest-caps.mjs
 * SELFTEST: CAP_CHECK_SELFTEST=1 node --env-file=.env.local scripts/check-postgrest-caps.mjs
 *           (forces every watch threshold to -1: MUST exit nonzero —
 *           proves the failure path executes; an instrument that cannot
 *           fail is not an instrument)
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

const HELPER_FILE = "lib/supabase/fetchAllRows.ts";

function classify(chain, before, file) {
  if (/\.(insert|upsert|update|delete)\(/.test(chain)) return "write";
  if (/head:\s*true/.test(chain)) return "count-only";
  if (/\.range\(/.test(chain)) {
    // The RANGE RULE: .range is only trusted as "paged" when the loop is
    // fetchAllRows' own. A visible fetchAllRows( call immediately upstream
    // of the .from( marks a helper call site (the factory lambda pattern:
    // fetchAllRows((from, to) => supabase.from(...).range(from, to))).
    if (file === HELPER_FILE) return "paged-helper";
    if (/fetchAllRows\s*(\<[^>]*\>)?\s*\(/.test(before)) return "paged-helper";
    return "RANGE-HAND-ROLLED";
  }
  if (/\.(single|maybeSingle|limit)\(/.test(chain)) return "bounded";
  if (/\.select\(/.test(chain)) return "UNBOUNDED";
  return "other";
}

const sites = [];
for (const file of SCAN_DIRS.flatMap((d) => [...walk(d)])) {
  const src = readFileSync(file, "utf8");
  const rel = relative(".", file).replace(/\\/g, "/");
  const re = /\.from\(\s*["']([a-z_]+)["']\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const chain = captureChain(src, m.index);
    const before = src.slice(Math.max(0, m.index - 300), m.index);
    const line = src.slice(0, m.index).split("\n").length;
    sites.push({
      file: rel,
      table: m[1],
      line,
      kind: classify(chain, before, rel),
    });
  }
}

// Sites requiring a registry reason: UNBOUNDED reads and hand-rolled
// .range() call sites. Occurrence index is counted among
// registration-requiring sites of the same (file, table) — the key
// survives line-number churn but not reordering, which is the acceptable
// trade (reordering such reads of the same table in one file is rare and
// the failure is loud, not silent).
const NEEDS_REGISTRATION = new Set(["UNBOUNDED", "RANGE-HAND-ROLLED"]);
const unbounded = [];
const perFileTable = new Map();
for (const s of sites) {
  if (!NEEDS_REGISTRATION.has(s.kind)) continue;
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
      s.kind === "RANGE-HAND-ROLLED"
        ? `HAND-ROLLED .range(): ${s.file}:${s.line} reads "${s.table}" with .range() outside fetchAllRows — a single-shot .range(0, 999) looks like paging and isn't.\n` +
            `  Either use lib/supabase/fetchAllRows.ts, or register "${s.key}" in ${REGISTRY_PATH} with a reason that proves the loop.`
        : `NEW UNBOUNDED READ: ${s.file}:${s.line} reads "${s.table}" with no .range()/.limit()/.single() and no head:true count.\n` +
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

const mode = process.argv.includes("--static")
  ? "static"
  : process.argv.includes("--build-gate")
    ? "build-gate"
    : "full";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(url && key);

console.log(`Mode: ${mode}`);
console.log("Registration-requiring sites (unbounded reads + hand-rolled .range):");
for (const s of unbounded) {
  const reg = registry.sites[s.key];
  console.log(`  [${s.kind}] ${s.key} @ line ${s.line} — ${reg ? reg.reason : "*** UNREGISTERED ***"}`);
}

let liveRan = false;
if (mode === "static") {
  console.log("\nWatches: skipped (--static).");
} else if (!hasCreds) {
  if (mode === "full") {
    console.error(
      "FAIL (env): NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — the live-count half cannot run, and skipping it silently is the exact failure family it exists to catch. Use --static if you mean static-only."
    );
    process.exit(2);
  }
  // --build-gate without credentials: the static half must never be
  // gated behind the credentialed half — pass on static alone, LOUDLY.
  console.log(
    "\nWatches: SKIPPED — no Supabase credentials in this environment (--build-gate). The static half above still gates. Run the full check where credentials exist."
  );
} else {
  liveRan = true;
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const selftest = process.env.CAP_CHECK_SELFTEST === "1";

  console.log(
    selftest
      ? "\nWatches (SELFTEST: thresholds forced to -1, every row-bearing table MUST fail):"
      : "\nWatches (live count vs threshold; cap is 1,000):"
  );
  const rows = [["label", "table", "count", "maxRows", "status"]];
  for (const [label, w] of Object.entries(registry.watch)) {
    const maxRows = selftest ? -1 : w.maxRows;
    // One retry on transient failures — this runs inside the build gate,
    // and a single blip should not block a deploy; a persistent failure
    // should (unknown is not zero).
    let res = await supabase.from(w.table).select("*", { count: "exact", head: true });
    if (res.error) {
      await new Promise((r) => setTimeout(r, 1500));
      res = await supabase.from(w.table).select("*", { count: "exact", head: true });
    }
    const { count, error } = res;
    if (error || count === null) {
      failures.push(`WATCH "${label}": count failed twice — ${error?.message ?? "null count"} (unknown is not zero)`);
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
}

// --- 4. Verdict --------------------------------------------------------

const kinds = {
  write: 0,
  "count-only": 0,
  bounded: 0,
  "paged-helper": 0,
  UNBOUNDED: 0,
  "RANGE-HAND-ROLLED": 0,
  other: 0,
};
for (const s of sites) kinds[s.kind]++;
console.log(
  `\nScanned ${sites.length} .from() sites: ${kinds.write} writes, ${kinds["count-only"]} count-only, ` +
    `${kinds.bounded} bounded, ${kinds["paged-helper"]} paged-via-helper, ` +
    `${kinds.UNBOUNDED + kinds["RANGE-HAND-ROLLED"]} registration-requiring, ${kinds.other} other.`
);

if (failures.length > 0) {
  console.error("\nFAIL:\n" + failures.map((f) => "- " + f).join("\n"));
  process.exit(1);
}
console.log(`PASS${liveRan ? "" : " (static half only)"}`);
