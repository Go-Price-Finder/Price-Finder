"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";

type AuthContextValue = {
  user: User | null;
  /** True until the initial session check has resolved (avoids a
   *  logged-out flash while Supabase reads the session from cookies). */
  loading: boolean;
  /**
   * Signs out via the browser Supabase client and clears `user` right
   * away. `signOutAction` (a Server Action) also signs out, but a
   * server-side `redirect()` is a soft client-side navigation in Next.js,
   * not a full reload — so on its own, nothing tells this provider's
   * `onAuthStateChange` listener (which only reacts to *client-side*
   * auth calls) that the session ended, and the header, wishlist, etc.
   * kept showing stale logged-in state until the next hard refresh.
   * Calling this first makes the sign-out visible immediately everywhere
   * that reads `useAuth()`.
   */
  signOutLocally: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    // Keeps auth state in sync across tabs, token refreshes, and sign-out —
    // this is what makes "stay logged in across refreshes" actually work
    // on the client, on top of the cookie-based session Supabase persists.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOutLocally = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signOutLocally }),
    [user, loading, signOutLocally]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
