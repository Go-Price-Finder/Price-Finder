#!/usr/bin/env node
/** Build _h-<name>.json pair files from the resolved-link JSONs so every
 * partner can be scored by the SAME second method (products.json), not
 * just the one that produced the original number (handover rule 16). */
import { readFileSync, writeFileSync } from "node:fs";

const toPairs = (rows) => rows.map((r) => {
  const u = new URL(r.dest);
  return [r.slug, u.pathname, u.searchParams.get("variant")];
});

const frozen = JSON.parse(readFileSync("scripts/_deeplink-targets.json", "utf8")).resolved;
const write = (name, rows) => {
  writeFileSync(`scripts/_h-${name}.json`, JSON.stringify({ pairs: toPairs(rows) }));
  console.log(`${name}: ${rows.length} links`);
};

write("canvas-vows", frozen.filter((r) => r.partner === "canvas-vows"));
write("tsar-bomba-default", frozen.filter((r) => r.partner === "tsar-bomba"));
write("tsar-bomba", JSON.parse(readFileSync("scripts/_links-tsar-bomba.json", "utf8")).resolved);
write("king-koil", JSON.parse(readFileSync("scripts/_links-king-koil.json", "utf8")).resolved);
