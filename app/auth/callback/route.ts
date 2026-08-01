import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for Supabase email confirmation / magic links
 * (`emailRedirectTo` in lib/supabase/actions.ts points here). Exchanges the
 * one-time code for a real session, then sends the user on to their
 * wishlist/account page — or back to login with an error if the link is
 * invalid or expired.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/wishlist";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/auth/login?error=confirmation-failed`
  );
}
