import { Resend } from "resend";

/**
 * Resend client for transactional email — price-drop alerts today, and a
 * reasonable home for future emails (password reset, purchase receipts)
 * later.
 *
 * RESEND_API_KEY is read from the environment; see .env.local.example.
 * Lazy initialization ensures the client is only created when actually
 * needed, preventing errors during build time when the API key might not
 * be set. This allows `next dev` / `next build` to work without requiring
 * a configured key.
 */
let _resend: Resend | null = null;

export function getResendClient(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// Export a getter property for backward compatibility
export const resend = {
  get emails() {
    return getResendClient().emails;
  },
};

/**
 * The verified "from" address. In production this must be on a domain
 * you've verified in the Resend dashboard (Domains → Add Domain) — see
 * supabase/README.md's "Price drop alerts" section for the full checklist.
 * Defaults to Resend's shared onboarding@resend.dev sender, which works
 * without domain verification but is rate-limited and meant for testing
 * only.
 */
export const EMAIL_FROM =
  process.env.RESEND_FROM_EMAIL ?? "Go Price Finder <onboarding@resend.dev>";
