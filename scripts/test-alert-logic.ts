/**
 * Unit-tests evaluateAlertState() — the comparison + reset logic behind the
 * price-drop alert feature — without needing a live Supabase project or
 * Resend key. Run with:
 *
 *   npx tsx scripts/test-alert-logic.ts
 *
 * This is a plain assertion script, not a test-runner suite (the repo has
 * no test framework configured yet); it exits non-zero on any failure so
 * it's still safe to wire into CI later.
 */
import { evaluateAlertState } from "../lib/alerts/evaluateAlertState";

type Case = {
  name: string;
  input: Parameters<typeof evaluateAlertState>[0];
  expected: ReturnType<typeof evaluateAlertState>;
};

const cases: Case[] = [
  {
    name: "no target price set → do nothing",
    input: { targetPrice: null, currentPrice: 50, alertSent: false },
    expected: { action: "none", reason: "no_target" },
  },
  {
    name: "price above target, never alerted → do nothing",
    input: { targetPrice: 100, currentPrice: 120, alertSent: false },
    expected: { action: "none", reason: "above_target" },
  },
  {
    name: "price at target, never alerted → send",
    input: { targetPrice: 100, currentPrice: 100, alertSent: false },
    expected: { action: "send", reason: "price_at_or_below_target" },
  },
  {
    name: "price below target, never alerted → send",
    input: { targetPrice: 100, currentPrice: 79.99, alertSent: false },
    expected: { action: "send", reason: "price_at_or_below_target" },
  },
  {
    name: "price still at/below target, already alerted → do nothing (no re-send)",
    input: { targetPrice: 100, currentPrice: 95, alertSent: true },
    expected: { action: "none", reason: "already_sent" },
  },
  {
    name: "price rose back above target after alert → reset so it can fire again later",
    input: { targetPrice: 100, currentPrice: 110, alertSent: true },
    expected: { action: "reset", reason: "price_rose_above_target" },
  },
  {
    name: "price exactly back at target after alert → still counts as at-target, no reset",
    input: { targetPrice: 100, currentPrice: 100, alertSent: true },
    expected: { action: "none", reason: "already_sent" },
  },
];

let failures = 0;

for (const testCase of cases) {
  const actual = evaluateAlertState(testCase.input);
  const pass =
    actual.action === testCase.expected.action && actual.reason === testCase.expected.reason;

  console.log(
    `${pass ? "✓" : "✗"} ${testCase.name}\n    got: ${JSON.stringify(actual)}${
      pass ? "" : `\n    expected: ${JSON.stringify(testCase.expected)}`
    }`
  );

  if (!pass) failures += 1;
}

console.log(`\n${cases.length - failures}/${cases.length} passed`);

if (failures > 0) {
  process.exit(1);
}
