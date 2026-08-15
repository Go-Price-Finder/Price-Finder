import { createAdminClient } from "@/lib/supabase/admin";
import type { WishlistRetailerId } from "@/lib/types";

/**
 * Publisher-side cashback sync — polls AWIN's Transactions API for sales
 * attributed to us via clickref (see the mobile app's
 * lib/affiliateClicks.ts, which generates the click_id and appends it to
 * every outbound deep link), matches each transaction back to the app user
 * who tapped through (via public.affiliate_clicks), and records the
 * purchase + a cashback ledger entry.
 *
 * IMPORTANT — unlike every other integration in this codebase, this one has
 * NOT been live-verified against AWIN's real API. Every other AWIN
 * integration here (scripts/awin-status-report.ts, lib/pricing/refreshPrices.ts)
 * was built and then run against production AWIN data before being trusted.
 * This file was written from AWIN's public developer documentation only —
 * the credential needed to actually call api.awin.com (AWIN_API_TOKEN) is
 * never touched by an AI assistant working on this project, so there was no
 * way to confirm the exact response field names (clickRefs.clickRef vs a
 * flat clickRef, the date format AWIN actually expects) against a real
 * response. Run this manually against a real (or sandbox) AWIN account and
 * log the raw response shape before trusting it in production — see the
 * defensive field-name fallbacks below, which exist because of this gap,
 * not as a stylistic choice.
 *
 * AWIN model, for anyone new to this (confirmed via AWIN's own docs, not
 * assumed): AWIN does NOT push a postback to publishers. Publishers poll
 * AWIN's Transactions API instead — see
 * https://developer.awin.com/apidocs/returns-a-list-of-transactions-for-a-given-publisher.
 *
 * Requires (same Vercel env vars scripts/awin-status-report.ts already
 * uses): AWIN_API_TOKEN, AWIN_PUBLISHER_ID.
 *
 * Cashback rate: 50% of AWIN's reported commissionAmount is passed back to
 * the user as cashback — a business decision made here, not a number pulled
 * from anywhere else in the codebase. Change CASHBACK_SHARE below to adjust.
 *
 * commissionStatus handling:
 * - "declined": never recorded at all — no purchase, no cashback, no ledger
 *   entry. Nothing was ever promised for a sale AWIN says didn't happen.
 * - "pending" / "approved", not seen before (no matching awin_transaction_id):
 *   records purchases + cashback_claims + one ledger entry ("pending" or
 *   "available" respectively).
 * - Already recorded, but AWIN's status has since changed: appends a NEW
 *   ledger entry reflecting the transition (ledger-style — an audit trail,
 *   never overwrites a prior entry) rather than mutating the existing row.
 *   pending -> approved appends an "available" entry for the same amount;
 *   pending/approved -> declined appends a "reversed" entry for the
 *   negative of the original amount, netting the running total to zero.
 */

const API_BASE = "https://api.awin.com";
const CASHBACK_SHARE = 0.5;

type AwinTransaction = {
  id: number | string;
  commissionStatus?: string;
  clickRefs?: { clickRef?: string };
  clickRef?: string;
  saleAmount?: number;
  commissionAmount?: number;
};

export type SyncCashbackResult = {
  fetched: number;
  matchedClicks: number;
  unmatchedClicks: number;
  newlyRecorded: number;
  transitioned: number;
  declinedSkipped: number;
  errors: string[];
};

function formatAwinDate(d: Date): string {
  // AWIN's documented format is space-separated, not ISO's "T"/"Z" — see
  // the header comment on why this hasn't been confirmed against a live
  // response.
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function extractClickRef(t: AwinTransaction): string | null {
  return t.clickRefs?.clickRef ?? t.clickRef ?? null;
}

export async function syncAwinTransactions(daysBack = 3): Promise<SyncCashbackResult> {
  const token = process.env.AWIN_API_TOKEN;
  const publisherId = process.env.AWIN_PUBLISHER_ID;
  if (!token || !publisherId) {
    throw new Error(
      "AWIN_API_TOKEN / AWIN_PUBLISHER_ID not set — sync-cashback cannot run without them " +
        "(same Vercel env vars scripts/awin-status-report.ts already uses)."
    );
  }

  const result: SyncCashbackResult = {
    fetched: 0,
    matchedClicks: 0,
    unmatchedClicks: 0,
    newlyRecorded: 0,
    transitioned: 0,
    declinedSkipped: 0,
    errors: [],
  };

  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const url =
    `${API_BASE}/publishers/${publisherId}/transactions/` +
    `?startDate=${encodeURIComponent(formatAwinDate(start))}` +
    `&endDate=${encodeURIComponent(formatAwinDate(end))}` +
    `&dateType=transactionDate`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    result.errors.push(`AWIN transactions fetch failed: HTTP ${res.status} — ${text.slice(0, 300)}`);
    return result;
  }

  let transactions: AwinTransaction[];
  try {
    const parsed = JSON.parse(text);
    transactions = Array.isArray(parsed) ? parsed : (parsed.data ?? []);
  } catch (err) {
    result.errors.push(`AWIN transactions response wasn't valid JSON: ${String(err)}`);
    return result;
  }
  result.fetched = transactions.length;

  const supabase = createAdminClient();

  for (const t of transactions) {
    const commissionStatus = (t.commissionStatus ?? "").toLowerCase();
    const awinTransactionId = String(t.id);
    const clickRef = extractClickRef(t);

    // Already recorded? Check for a status transition before anything else.
    const { data: existingClaim, error: existingClaimError } = await supabase
      .from("cashback_claims")
      .select("id, cashback_amount")
      .eq("awin_transaction_id", awinTransactionId)
      .maybeSingle();
    if (existingClaimError) {
      result.errors.push(`Lookup failed for AWIN transaction ${awinTransactionId}: ${existingClaimError.message}`);
      continue;
    }

    if (existingClaim) {
      const { data: latestEntry, error: latestEntryError } = await supabase
        .from("cashback_ledger_entries")
        .select("status")
        .eq("claim_id", existingClaim.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestEntryError) {
        result.errors.push(`Ledger lookup failed for claim ${existingClaim.id}: ${latestEntryError.message}`);
        continue;
      }

      const currentlyDeclined = latestEntry?.status === "reversed";
      const currentlyAvailable = latestEntry?.status === "available";

      if (commissionStatus === "approved" && !currentlyAvailable && !currentlyDeclined) {
        const { error } = await supabase.from("cashback_ledger_entries").insert({
          claim_id: existingClaim.id,
          status: "available",
          amount: existingClaim.cashback_amount,
          note: `AWIN transaction ${awinTransactionId} approved`,
        });
        if (error) result.errors.push(`Failed to record approval for claim ${existingClaim.id}: ${error.message}`);
        else result.transitioned++;
      } else if (commissionStatus === "declined" && !currentlyDeclined) {
        const { error } = await supabase.from("cashback_ledger_entries").insert({
          claim_id: existingClaim.id,
          status: "reversed",
          amount: -existingClaim.cashback_amount,
          note: `AWIN transaction ${awinTransactionId} declined after being recorded`,
        });
        if (error) result.errors.push(`Failed to record reversal for claim ${existingClaim.id}: ${error.message}`);
        else result.transitioned++;
      }
      continue;
    }

    // Not seen before.
    if (commissionStatus === "declined") {
      result.declinedSkipped++;
      continue;
    }

    if (!clickRef) {
      result.unmatchedClicks++;
      continue;
    }

    const { data: click, error: clickError } = await supabase
      .from("affiliate_clicks")
      .select("user_id, product_id, retailer")
      .eq("click_id", clickRef)
      .maybeSingle();
    if (clickError) {
      result.errors.push(`Click lookup failed for clickref ${clickRef}: ${clickError.message}`);
      continue;
    }
    if (!click) {
      result.unmatchedClicks++;
      continue;
    }
    result.matchedClicks++;

    const saleAmount = t.saleAmount ?? 0;
    const commissionAmount = t.commissionAmount ?? 0;
    const cashbackAmount = commissionAmount * CASHBACK_SHARE;
    const ledgerStatus = commissionStatus === "approved" ? "available" : "pending";

    const { data: purchase, error: purchaseError } = await supabase
      .from("purchases")
      .insert({
        user_id: click.user_id,
        product_id: click.product_id,
        retailer: click.retailer as WishlistRetailerId,
        amount_spent: saleAmount,
      })
      .select("id")
      .single();
    if (purchaseError) {
      result.errors.push(`Failed to record purchase for transaction ${awinTransactionId}: ${purchaseError.message}`);
      continue;
    }

    const { data: claim, error: claimError } = await supabase
      .from("cashback_claims")
      .insert({
        user_id: click.user_id,
        vertical: "products",
        retailer: click.retailer as WishlistRetailerId,
        product_id: click.product_id,
        purchase_id: purchase.id,
        order_amount: saleAmount,
        cashback_amount: cashbackAmount,
        click_id: clickRef,
        awin_transaction_id: awinTransactionId,
      })
      .select("id")
      .single();
    if (claimError) {
      result.errors.push(`Failed to record cashback claim for transaction ${awinTransactionId}: ${claimError.message}`);
      continue;
    }

    const { error: ledgerError } = await supabase.from("cashback_ledger_entries").insert({
      claim_id: claim.id,
      status: ledgerStatus,
      amount: cashbackAmount,
      note: `AWIN transaction ${awinTransactionId}, commissionStatus=${commissionStatus}`,
    });
    if (ledgerError) {
      result.errors.push(`Failed to record ledger entry for claim ${claim.id}: ${ledgerError.message}`);
      continue;
    }

    result.newlyRecorded++;
  }

  return result;
}
