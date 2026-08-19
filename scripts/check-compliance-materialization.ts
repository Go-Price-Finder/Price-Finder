/**
 * A compliance gate whose decision is MATERIALISED into stored data at
 * write time cannot be changed by flipping the gate (findings §19b, §21).
 * Flipping such a flag looks like a policy change and is a silent no-op
 * until the affected rows are re-synced — and the failure mode is that
 * NOTHING HAPPENS, which is the hardest kind to notice.
 *
 * This check compares what lib/partner-compliance.json says TODAY against
 * what public.catalog_products actually holds, and fails when they
 * disagree. It is the enforcement half of the audit table recorded in
 * lib/partner-compliance.json's $materialization block.
 *
 * WHAT IT ASSERTS (both directions):
 *   A. imageUsagePermission — if canShowRealImages(p) then NO row of p
 *      may hold the pending placeholder; if not, EVERY row must. Catches
 *      both "unlocked images but never re-synced" (§19b, real) and the
 *      more serious reverse: permission withdrawn but real photos still
 *      served from the DB.
 *   B. status / comparisonEngineConfirmed — if a partner is NOT live per
 *      checkImportGate, it must have ZERO catalog_products rows. This is
 *      the dangerous direction: lib/partners.ts filters non-live partners
 *      out of the STATIC export at module load, but rows already written
 *      to the DB are never revisited (lib/catalog.ts deliberately does
 *      not re-check the gate), so suspending a partner in the registry
 *      does nothing to production until its rows are removed.
 *   C. A live partner that has a generated data file but zero rows is
 *      reported as a WARNING, not a failure — that is the benign
 *      direction (nothing is shown) and is the normal state mid-import.
 *
 * MODES: --build-gate skips loudly when Supabase credentials are absent
 * (the static half of the compliance story lives in the registry itself);
 * default requires them and exits 2 if missing.
 * SELFTEST: COMPLIANCE_CHECK_SELFTEST=1 inverts every expectation, which
 * MUST produce failures — an instrument that cannot fail is not one.
 *
 * Run: npx tsx --env-file=.env.local scripts/check-compliance-materialization.ts
 */
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import registry from "../lib/partner-compliance.json";
import { PARTNERS } from "../lib/partners";
import {
  canShowRealImages,
  checkImportGate,
  IMAGE_PENDING_PLACEHOLDER,
} from "../lib/partner-compliance";

const mode = process.argv.includes("--build-gate") ? "build-gate" : "full";
const selftest = process.env.COMPLIANCE_CHECK_SELFTEST === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!url || !key) {
    if (mode === "build-gate") {
      console.log(
        "Compliance materialisation check: SKIPPED — no Supabase credentials in this environment (--build-gate). Run it where credentials exist."
      );
      return;
    }
    console.error(
      "FAIL (env): NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — this check compares the registry against stored rows and cannot run blind."
    );
    process.exit(2);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const failures: string[] = [];
  const warnings: string[] = [];
  const rows: string[][] = [["partner", "rows", "imagesAllowed", "placeholderRows", "live", "verdict"]];

  const partnerIds = Object.keys(registry.partners);
  for (const id of partnerIds) {
    const { count: total, error: e1 } = await supabase
      .from("catalog_products")
      .select("*", { count: "exact", head: true })
      .eq("partner_id", id);
    if (e1 || total === null) {
      failures.push(`${id}: row count failed — ${e1?.message ?? "null count"} (unknown is not zero)`);
      continue;
    }
    const { count: placeholders, error: e2 } = await supabase
      .from("catalog_products")
      .select("*", { count: "exact", head: true })
      .eq("partner_id", id)
      .eq("image", IMAGE_PENDING_PLACEHOLDER);
    if (e2 || placeholders === null) {
      failures.push(`${id}: placeholder count failed — ${e2?.message ?? "null count"}`);
      continue;
    }

    let imagesAllowed = canShowRealImages(id);
    let live = checkImportGate(id).allowed;
    if (selftest) {
      imagesAllowed = !imagesAllowed;
      live = !live;
    }
    const verdicts: string[] = [];

    if (total > 0) {
      // A. image materialisation. Compared against what the CURRENT
      // registry + static data would produce (PARTNERS is normalised with
      // today's flag), not against a blanket zero — otherwise a product
      // whose image simply failed to download at import time reads as a
      // stale sync and the check names the wrong remedy. Measured on the
      // first run: tsar-bomba has 10 such products baked into its static
      // data file, faithfully mirrored into the DB. That is an import-time
      // image gap, NOT a materialisation defect.
      const expectedPlaceholders = (PARTNERS.find((x) => x.id === id)?.products ?? []).filter(
        (x) => x.image === IMAGE_PENDING_PLACEHOLDER
      ).length;
      if (placeholders > expectedPlaceholders) {
        failures.push(
          `${id}: ${placeholders} stored rows hold the pending placeholder but the current registry + static data expect ${expectedPlaceholders}. ` +
            `Flipping a compliance flag does not rewrite stored rows — re-run this partner's catalog sync (findings §19b).`
        );
        verdicts.push("STALE-PLACEHOLDER");
      }
      if (placeholders < expectedPlaceholders) {
        failures.push(
          `${id}: only ${placeholders} stored rows hold the placeholder but ${expectedPlaceholders} are expected — ` +
            `${expectedPlaceholders - placeholders} row(s) are serving real photos the current registry does not permit. Re-sync this partner NOW.`
        );
        verdicts.push("SERVING-UNPERMITTED-IMAGES");
      }
      if (imagesAllowed && expectedPlaceholders > 0 && placeholders === expectedPlaceholders) {
        warnings.push(
          `${id}: ${expectedPlaceholders} product(s) show the placeholder even though images are permitted — their photos failed to download at import and were never retried. ` +
            `An import-time gap, not a materialisation defect; DB and static data agree.`
        );
        verdicts.push("import-image-gap");
      }
      // B. liveness materialisation
      if (!live) {
        failures.push(
          `${id}: partner is NOT live per checkImportGate (status/comparisonEngineConfirmed), but ${total} catalog_products rows exist and are being served. ` +
            `The static export filters non-live partners at module load; stored rows are never revisited. Remove the rows or restore the status.`
        );
        verdicts.push("NOT-LIVE-BUT-SERVED");
      }
    } else if (live && existsSync(`lib/${id}-data.ts`)) {
      warnings.push(`${id}: live and has a data file, but zero catalog_products rows — sync has not run (benign: nothing is shown).`);
      verdicts.push("no-rows");
    }
    if (verdicts.length === 0) verdicts.push("ok");
    rows.push([id, String(total), String(imagesAllowed), String(placeholders), String(live), verdicts.join(",")]);
  }

  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  console.log(selftest ? "Compliance materialisation (SELFTEST: expectations inverted, MUST fail):" : "Compliance materialisation (registry vs stored rows):");
  for (const r of rows) console.log("  " + r.map((c, i) => c.padEnd(w[i])).join("  "));
  for (const warn of warnings) console.log(`  note: ${warn}`);

  if (failures.length) {
    console.error("\nFAIL:\n" + failures.map((f) => "- " + f).join("\n"));
    process.exit(1);
  }
  console.log("PASS");
}

main();
