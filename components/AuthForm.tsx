"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signInAction, signUpAction } from "@/lib/supabase/actions";
import { getUsernameError, isPasswordValid, isUsernameValid } from "@/lib/validation";
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";

export default function AuthForm({
  mode,
  redirectTo,
}: {
  mode: "login" | "signup";
  /** Where to send the user after a successful login (e.g. the page they
   *  were bounced from by middleware.ts). Ignored in signup mode. */
  redirectTo?: string;
}) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isSignup = mode === "signup";
  const usernameError = isSignup ? getUsernameError(username) : null;
  const passwordsMatch = password === confirmPassword;
  const confirmPasswordError =
    isSignup && confirmPassword && !passwordsMatch
      ? "Passwords don't match."
      : null;
  const canSubmit = isSignup
    ? isUsernameValid(username) &&
      isPasswordValid(password) &&
      confirmPassword.length > 0 &&
      passwordsMatch
    : true;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = isSignup
        ? await signUpAction(email, password, username)
        : await signInAction(email, password, redirectTo);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-gilt-500/20 bg-noir-800 p-6 shadow-soft sm:p-8">
      <h1 className="font-display text-2xl font-medium text-ivory-50">
        {isSignup ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ivory-300">
        {isSignup
          ? "Save items across retailers, track price history, and see your spending in one place."
          : "Log in to see your wishlist, purchase history, and total spending."}
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-4">
        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
          >
            {error}
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-ivory-300">
            Email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-2xl border border-gilt-500/25 bg-noir-800 px-4 py-3 text-sm text-ivory-50 placeholder:text-ivory-400 transition-all duration-200 focus:border-gilt-400 focus:outline-none focus:ring-4 focus:ring-gilt-500/20"
          />
        </label>

        {isSignup && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-ivory-300">
              Username
            </span>
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => setUsernameTouched(true)}
              placeholder="jane_doe"
              aria-invalid={usernameTouched && !!usernameError}
              className={`rounded-2xl border bg-noir-800 px-4 py-3 text-sm text-ivory-50 placeholder:text-ivory-400 transition-all duration-200 focus:outline-none focus:ring-4 ${
                usernameTouched && usernameError
                  ? "border-red-400/50 focus:border-red-400 focus:ring-red-500/20"
                  : "border-gilt-500/25 focus:border-gilt-400 focus:ring-gilt-500/20"
              }`}
            />
            {usernameTouched && usernameError ? (
              <span className="mt-0.5 text-xs text-red-400">{usernameError}</span>
            ) : (
              <span className="mt-0.5 text-xs text-ivory-300">
                Letters, numbers, underscores, and dashes only.
              </span>
            )}
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-ivory-300">
            Password
          </span>
          <input
            type="password"
            required
            minLength={isSignup ? 8 : 6}
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="rounded-2xl border border-gilt-500/25 bg-noir-800 px-4 py-3 text-sm text-ivory-50 placeholder:text-ivory-400 transition-all duration-200 focus:border-gilt-400 focus:outline-none focus:ring-4 focus:ring-gilt-500/20"
          />
          {isSignup ? (
            <PasswordStrengthMeter password={password} />
          ) : (
            <span className="mt-0.5 flex items-center justify-between text-xs text-ivory-300">
              At least 6 characters.
              <Link
                href="/auth/forgot-password"
                className="font-medium text-gilt-400 transition-colors hover:text-gilt-300"
              >
                Forgot password?
              </Link>
            </span>
          )}
        </label>

        {isSignup && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-ivory-300">
              Confirm password
            </span>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => setConfirmPasswordTouched(true)}
              placeholder="••••••••"
              aria-invalid={confirmPasswordTouched && !!confirmPasswordError}
              className={`rounded-2xl border bg-noir-800 px-4 py-3 text-sm text-ivory-50 placeholder:text-ivory-400 transition-all duration-200 focus:outline-none focus:ring-4 ${
                confirmPasswordTouched && confirmPasswordError
                  ? "border-red-400/50 focus:border-red-400 focus:ring-red-500/20"
                  : "border-gilt-500/25 focus:border-gilt-400 focus:ring-gilt-500/20"
              }`}
            />
            {confirmPasswordTouched && confirmPasswordError ? (
              <span className="mt-0.5 text-xs text-red-400">
                {confirmPasswordError}
              </span>
            ) : (
              confirmPassword.length > 0 &&
              passwordsMatch && (
                <span className="mt-0.5 text-xs text-gilt-400">
                  Passwords match.
                </span>
              )
            )}
          </label>
        )}

        <button
          type="submit"
          disabled={isPending || !canSubmit}
          className="mt-2 flex items-center justify-center rounded-full bg-gilt-500 px-5 py-3 text-sm font-medium text-accent-ink transition-all duration-200 hover:bg-gilt-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending
            ? isSignup
              ? "Creating account…"
              : "Signing in…"
            : isSignup
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ivory-300">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-gilt-400 transition-colors hover:text-gilt-300"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to Go Price Finder?{" "}
            <Link
              href="/auth/signup"
              className="font-medium text-gilt-400 transition-colors hover:text-gilt-300"
            >
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
