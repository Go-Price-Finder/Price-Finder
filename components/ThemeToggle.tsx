"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme-context";
import { MoonIcon, SunIcon } from "./icons";

/**
 * Icon-only toggle between the light (default) and dark theme. Shows a
 * moon (switch to dark) while light, a sun (switch to light) while dark —
 * the icon always represents the theme you'd switch *to*, not the one
 * you're currently on, matching the convention used by most OS/browser
 * theme switches.
 *
 * The `mounted` gate: the server always renders assuming the light
 * default (it has no access to localStorage), while the client's first
 * render — after app/layout.tsx's blocking script has already set the
 * real `data-theme` — may compute "dark" immediately. Swapping between
 * two entirely different icon elements on that mismatch isn't something
 * `suppressHydrationWarning` covers (it only silences text-content
 * mismatches), so instead this renders the light-default Moon on both the
 * server and the client's first pass, then corrects itself in a
 * post-mount effect — the same pattern libraries like next-themes use.
 * The page's actual colors are never wrong either way, since those come
 * from the `data-theme` attribute and CSS, not from this component.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && theme === "dark";
  const switchingTo = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${switchingTo} theme`}
      title={`Switch to ${switchingTo} theme`}
      className={`flex h-11 w-11 items-center justify-center rounded-full text-ivory-100 transition-colors hover:bg-noir-700 hover:text-ivory-50 ${className}`}
    >
      {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}
