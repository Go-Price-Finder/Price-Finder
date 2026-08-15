-- Price Finder — cashback sync dedupe key
--
-- Dedupe key so the AWIN transaction-sync cron (lib/cashback/syncAwinTransactions.ts)
-- can safely re-poll overlapping date ranges — needed to catch AWIN
-- commissionStatus transitions (pending -> approved/declined) — without ever
-- double-recording the same transaction. Nullable because existing test
-- claims (created before this sync job existed) have no AWIN transaction
-- behind them.
--
-- Applied directly to production via the Supabase MCP on 2026-08-15; this
-- file exists so the schema is documented alongside every other migration,
-- not because it still needs to be run.

alter table public.cashback_claims
  add column awin_transaction_id text unique;
