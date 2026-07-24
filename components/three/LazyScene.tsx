"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Defers mounting a Three.js scene (and, since scenes are dynamically
 * imported with `ssr: false`, the whole @react-three/fiber + three chunk
 * behind it) until the section is within `rootMargin` of the viewport.
 * Combined with per-scene `next/dynamic` imports, this is what keeps the
 * ~300kB+ three.js/postprocessing bundle out of the *initial* page load —
 * only the section(s) near the top of the page pay for it up front.
 */
export default function LazyScene({
  children,
  rootMargin = "300px",
  className = "",
}: {
  children: React.ReactNode;
  rootMargin?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={`pointer-events-none absolute inset-0 -z-10 ${className}`} aria-hidden>
      {visible ? children : null}
    </div>
  );
}
