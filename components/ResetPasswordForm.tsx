"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updatePasswordAction } from "@/lib/supabase/actions";
import { isPasswordValid } from "@/lib/validation";
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";

export default function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const passwordsMatch = password === confirmPassword;
  const confirmPasswordError =
    confirmPassword && !passwordsMatch ? "Passwords don't match." : null;
  const canSubmit =
    isPasswordValid(password) && confirmPassword.length > 0 && passwordsMatch;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updatePasswordAction(password);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-gilt-500/20 bg-noir-800 p-8 shadow-soft-xl sm:p-10">
      <h1 className="font-display text-2xl font-medium text-ivory-50">
        Choose a new password
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ivory-300">
        You&#39;re here from a password reset link. Set a new password below
        and you&#39;ll be signed in.
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
            New password
          </span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="rounded-2xl border border-gilt-500/25 bg-noir-800 px-4 py-3 text-sm text-ivory-50 placeholder:text-ivory-400 transition-all duration-200 focus:border-gilt-400 focus:outline-none focus:ring-4 focus:ring-gilt-500/20"
          />
          <PasswordStrengthMeter password={password} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-ivory-300">
            Confirm new password
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

        <button
          type="submit"
          disabled={isPending || !canSubmit}
          className="mt-2 flex items-center justify-center rounded-full bg-gilt-500 px-5 py-3 text-sm font-medium text-accent-ink transition-all duration-200 hover:bg-gilt-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Updating…" : "Set new password"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ivory-300">
        Link expired?{" "}
        <Link
          href="/auth/forgot-password"
          className="font-medium text-gilt-400 transition-colors hover:text-gilt-300"
        >
          Request a new one
        </Link>
      </p>
    </div>
  );
}
