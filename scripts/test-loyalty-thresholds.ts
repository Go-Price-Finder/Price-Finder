/**
 * Verifies getLoyaltyStatus() against the exact spec from the "Fix Loyalty
 * Tier System" task: 0–499 unranked, 500–1499 Bronze, 1500–2999 Silver,
 * 3000–12999 Gold, 13000+ Diamond — including the reported bug case (27
 * points should be unranked, not Bronze) and every tier boundary.
 *
 * Run with: npx tsx scripts/test-loyalty-thresholds.ts
 */
import { getLoyaltyStatus, getLoyaltyPoints } from "../lib/loyalty";

type Case = { points: number; expectedTier: string; expectedUnranked: boolean };

const cases: Case[] = [
  { points: 0, expectedTier: "member", expectedUnranked: true },
  { points: 27, expectedTier: "member", expectedUnranked: true }, // the reported bug
  { points: 499, expectedTier: "member", expectedUnranked: true },
  { points: 500, expectedTier: "bronze", expectedUnranked: false },
  { points: 1499, expectedTier: "bronze", expectedUnranked: false },
  { points: 1500, expectedTier: "silver", expectedUnranked: false },
  { points: 2999, expectedTier: "silver", expectedUnranked: false },
  { points: 3000, expectedTier: "gold", expectedUnranked: false },
  { points: 12999, expectedTier: "gold", expectedUnranked: false },
  { points: 13000, expectedTier: "diamond", expectedUnranked: false },
  { points: 50000, expectedTier: "diamond", expectedUnranked: false },
];

let failures = 0;

// getLoyaltyStatus takes totalSpent, not points directly (points = floor(totalSpent / 10)),
// so drive each case via the equivalent totalSpent and confirm points come out as expected too.
for (const c of cases) {
  const totalSpent = c.points * 10;
  const status = getLoyaltyStatus(totalSpent);
  const pointsMatch = getLoyaltyPoints(totalSpent) === c.points;
  const pass =
    pointsMatch && status.tier.id === c.expectedTier && status.isUnranked === c.expectedUnranked;

  console.log(
    `${pass ? "✓" : "✗"} ${c.points} points → tier=${status.tier.id} isUnranked=${status.isUnranked}` +
      (pass ? "" : ` (expected tier=${c.expectedTier} isUnranked=${c.expectedUnranked})`)
  );

  if (!pass) failures += 1;
}

console.log(`\n${cases.length - failures}/${cases.length} passed`);
if (failures > 0) process.exit(1);
