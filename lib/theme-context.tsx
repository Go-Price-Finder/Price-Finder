"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";

/** Keep this key in sync with the blocking inline script in app/layout.tsx
 *  — that script reads the same key before first paint so returning
 *  dark-theme visitors never see a flash of the light default. */
export const THEME_STORAGE_KEY = "price-finder-theme";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Reads whatever `data-theme` the blocking inline script already stamped
 * onto <html> before this component mounts. During SSR (no `document`)
 * this deterministically returns "light", matching the site's actual
 * default and keeping the server-rendered HTML consistent with the
 * client's first render — the real (possibly "dark") value then applies
 * itself the instant this module runs client-side, since by then the
 * blocking script has already updated the DOM attribute.
 */
function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  const applyTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can throw in private-browsing/storage-blocked contexts —
      // the theme still applies for this page load, it just won't persist.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(theme === "light" ? "dark" : "light");
  }, [theme, applyTheme]);

  // Keep every open tab in sync if the theme is changed in another one.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== THEME_STORAGE_KEY) return;
      const next = e.newValue === "dark" ? "dark" : "light";
      setThemeState(next);
      document.documentElement.dataset.theme = next;
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: applyTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
