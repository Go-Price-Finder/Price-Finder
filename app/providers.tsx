"use client";

import { AuthProvider } from "@/lib/auth-context";
import { RetailerFilterProvider } from "@/lib/retailer-filter-context";
import { WishlistProvider } from "@/lib/wishlist-context";
import SmoothScrollProvider from "@/lib/SmoothScroll";
import { ThemeProvider } from "@/lib/theme-context";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WishlistProvider>
          <RetailerFilterProvider>
            <SmoothScrollProvider>{children}</SmoothScrollProvider>
          </RetailerFilterProvider>
        </WishlistProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
