"use server";

import { redirect } from "next/navigation";
import { createClient } from "./server";
import { getUsernameError, isPasswordValid } from "@/lib/validation";

export type AuthActionResult = { error: string } | void;

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function signUpAction(
  email: string,
  password: string,
  username: string
): Promise<AuthActionResult> {
  if (!email || !password || !username) {
    return { error: "Email, username, and password are required." };
  }

  // Defense in depth — the client already validates these live, but the
  // server action is the actual trust boundary.
  const usernameError = getUsernameError(username);
  if (usernameError) {
    return { error: usernameError };
  }
  if (!isPasswordValid(password)) {
    return {
      error:
        "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback`,
      // No session exists yet during pending email confirmation, so this is
      // the only way to hand the chosen username to handle_new_user() —
      // the trigger reads it out of raw_user_meta_data on insert.
      data: { display_name: username },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.session) {
    // Email confirmation is disabled on this project, so signUp already
    // returned an active session — the user is signed in immediately.
    redirect("/wishlist");
  }

  // Email confirmation is required (the default for new Supabase
  // projects). There's no session yet — nothing more to do until the user
  // clicks the link, which lands on /auth/callback.
  redirect("/auth/login?confirm=1");
}

export async function signInAction(
  email: string,
  password: string,
  redirectTo?: string
): Promise<AuthActionResult> {
  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  // Only ever follow an internal, relative path — redirectTo ultimately
  // comes from a URL query param, so treat it as untrusted input to avoid
  // an open-redirect via something like `//evil.example.com`.
  const isSafeRedirect =
    redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//");

  redirect(isSafeRedirect ? redirectTo : "/wishlist");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
