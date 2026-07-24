import { Resend } from "resend";

/**
 * Resend client for transactional email — price-drop alerts today, and a
 * reasonable home for future emails (password reset, purchase receipts)
 * later.
 *
 * RESEND_API_KEY is read from the environment; see .env.local.example.
 * It's fine for this to be unset in development before a real key is
 * added — the Resend SDK only throws once something actually calls
 * `resend.emails.send()` without a key, not at import time, so `next dev`
 * / `next build` still work with no key configured.
 */
export const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * The verified "from" address. In production this must be on a domain
 * you've verified in the Resend dashboard (Domains → Add Domain) — see
 * supabase/README.md's "Price drop alerts" section for the full checklist.
 * Defaults to Resend's shared onboarding@resend.dev sender, which works
 * without domain verification but is rate-limited and meant for testing
 * only.
 */
export const EMAIL_FROM =
  process.env.RESEND_FROM_EMAIL ?? "Price Finder <onboarding@resend.dev>";
