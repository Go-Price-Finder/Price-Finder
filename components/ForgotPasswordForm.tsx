"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/supabase/actions";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction(email);
      if (result?.error) setError(result.error);
      else setSent(true);
    });
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-gilt-500/20 bg-noir-800 p-8 shadow-soft-xl sm:p-10">
      <h1 className="font-display text-2xl font-medium text-ivory-50">
        Reset your password
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ivory-300">
        Enter the email you signed up with and we&#39;ll send you a link to
        choose a new password.
      </p>

      {sent ? (
        <div className="mt-8 rounded-2xl border border-gilt-500/30 bg-gilt-500/10 px-4 py-3 text-sm text-gilt-400">
          If an account exists for {email}, a reset link is on its way. The
          link lands you back here to choose a new password.
        </div>
      ) : (
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

          <button
            type="submit"
            disabled={isPending || !email}
            className="mt-2 flex items-center justify-center rounded-full bg-gilt-500 px-5 py-3 text-sm font-medium text-accent-ink transition-all duration-200 hover:bg-gilt-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ivory-300">
        Remembered it?{" "}
        <Link
          href="/auth/login"
          className="font-medium text-gilt-400 transition-colors hover:text-gilt-300"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
