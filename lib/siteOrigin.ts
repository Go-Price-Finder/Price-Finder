/**
 * The site's public origin, for the few places that need ABSOLUTE URLs —
 * email templates above all: email clients have no base URL, so a
 * site-relative src or href is broken in every client, everywhere
 * (findings doc §9j — all 954 catalog image paths are site-relative).
 *
 * Derived, never hand-maintained, in priority order:
 *   1. NEXT_PUBLIC_SITE_URL — this codebase's existing convention for
 *      absolute links (lib/supabase/actions.ts builds the sign-up
 *      confirmation link from it); localhost in dev, the deployed URL in
 *      production per .env.local.example.
 *   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel's system env var holding
 *      the project's production domain (the custom domain when one is
 *      assigned), present on every deployment with system env vars
 *      exposed. No protocol in the raw value, hence the https prefix.
 *
 * Returns null when neither exists. Callers must degrade gracefully —
 * an email with no image beats an email with a broken image — and must
 * never fall back to emitting the relative URL.
 */
export function siteOrigin(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelDomain) return `https://${vercelDomain}`;
  return null;
}
