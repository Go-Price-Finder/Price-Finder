"use server";

import { redirect } from "next/navigation";
import { createClient } from "./server";
import { getUsernameError, isPasswordValid } from "@/lib/validation";
import { siteOrigin } from "@/lib/siteOrigin";

export type AuthActionResult = { error: string } | void;

// Loud by design: a silently wrong origin here strands every confirming
// user on a dead page with an unusable link — which is exactly what the
// old `?? "http://localhost:3000"` fallback did in production for as long
// as NEXT_PUBLIC_SITE_URL was unset (findings doc §9l). Being rescued by
// another system's default is not being correct; refusing to run is.
const siteUrl = () => {
  const origin = siteOrigin();
  if (!origin) {
    throw new Error(
      "No site origin derivable (NEXT_PUBLIC_SITE_URL and VERCEL_PROJECT_PRODUCTION_URL both unset) — " +
        "refusing to build an auth redirect URL that would strand the user."
    );
  }
  return origin;
};

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

export async function requestPasswordResetAction(
  email: string
): Promise<AuthActionResult> {
  if (!email) {
    return { error: "Email is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Lands on the code-exchange callback, which forwards to the
    // set-a-new-password page with a live recovery session.
    redirectTo: `${siteUrl()}/auth/callback?next=/auth/reset-password`,
  });

  // Supabase deliberately does not error for unknown addresses (no account
  // enumeration) — an error here is rate limiting or configuration, and
  // the user should see it rather than wait for an email that won't come.
  if (error) {
    return { error: error.message };
  }
}

export async function updatePasswordAction(
  password: string
): Promise<AuthActionResult> {
  if (!isPasswordValid(password)) {
    return {
      error:
        "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.",
    };
  }

  const supabase = await createClient();
  // A recovery session (set by /auth/callback when the reset link was
  // clicked) is required — updateUser changes the password of whoever the
  // session belongs to, so without one there is nobody to update.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error:
        "Your reset link has expired or already been used. Request a new one from the forgot-password page.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  redirect("/wishlist");
}
