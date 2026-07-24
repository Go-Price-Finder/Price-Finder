"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./auth-context";
import { createClient } from "./supabase/client";
import {
  addToWishlist,
  getWishlistByUser,
  removeFromWishlist,
  setWishlistTargetPrice,
} from "./supabase/queries";
import type { RetailerId } from "./types";

export type WishlistItem = {
  /** wishlists.id (the row id, not the product id) */
  id: string;
  productId: string;
  retailer: RetailerId;
  priceSaved: number;
  /** Price the user asked to be notified at or below. Null = no alert set. */
  targetPrice: number | null;
  /** True once a price-drop email has already gone out for the current dip. */
  alertSent: boolean;
  alertSentAt: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    image_url: string | null;
    category: string | null;
  } | null;
};

type SavableProduct = {
  id: string;
  retailer: RetailerId;
  currentPrice: number;
};

type WishlistContextValue = {
  items: WishlistItem[];
  /** True while the initial fetch (or a user switch) is in flight. */
  loading: boolean;
  isSaved: (productId: string) => boolean;
  toggle: (product: SavableProduct) => Promise<void>;
  remove: (product: { id: string; retailer: RetailerId }) => Promise<void>;
  clear: () => Promise<void>;
  setTargetPrice: (
    product: { id: string; retailer: RetailerId },
    targetPrice: number | null
  ) => Promise<void>;
  count: number;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const rows = await getWishlistByUser(supabase, user.id);
      setItems(
        rows.map((row) => ({
          id: row.id,
          productId: row.products?.id ?? "",
          retailer: row.retailer,
          priceSaved: row.price_saved,
          targetPrice: row.target_price,
          alertSent: row.alert_sent,
          alertSentAt: row.alert_sent_at,
          createdAt: row.created_at,
          product: row.products,
        }))
      );
    } catch {
      // Table might not exist yet on a fresh Supabase project, or the
      // network could be down — fail quiet with an empty wishlist rather
      // than crashing the header/product cards that read from this.
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  const isSaved = useCallback(
    (productId: string) => items.some((item) => item.productId === productId),
    [items]
  );

  const toggle = useCallback(
    async (product: SavableProduct) => {
      if (!user) return;
      const supabase = createClient();
      const alreadySaved = items.some((item) => item.productId === product.id);

      // Optimistic update so the heart icon responds instantly; refresh()
      // reconciles with the real row (and its price_saved) right after.
      if (alreadySaved) {
        setItems((prev) => prev.filter((item) => item.productId !== product.id));
        try {
          await removeFromWishlist(supabase, {
            userId: user.id,
            productId: product.id,
            retailer: product.retailer,
          });
        } catch {
          // Ignore — refresh() below will restore the real state either way.
        }
      } else {
        try {
          await addToWishlist(supabase, {
            userId: user.id,
            productId: product.id,
            retailer: product.retailer,
            priceSaved: product.currentPrice,
          });
        } catch {
          // Ignore for the same reason as above.
        }
      }
      await refresh();
    },
    [user, items, refresh]
  );

  const remove = useCallback(
    async (product: { id: string; retailer: RetailerId }) => {
      if (!user) return;
      setItems((prev) => prev.filter((item) => item.productId !== product.id));
      const supabase = createClient();
      try {
        await removeFromWishlist(supabase, {
          userId: user.id,
          productId: product.id,
          retailer: product.retailer,
        });
      } finally {
        await refresh();
      }
    },
    [user, refresh]
  );

  const setTargetPrice = useCallback(
    async (product: { id: string; retailer: RetailerId }, targetPrice: number | null) => {
      if (!user) return;
      // Optimistic update — the input shouldn't wait on a round trip to
      // reflect what was just typed. alert_sent/alert_sent_at reset
      // optimistically too since the DB trigger (0003_add_target_price.sql)
      // does the same whenever target_price actually changes.
      setItems((prev) =>
        prev.map((item) =>
          item.productId === product.id && item.retailer === product.retailer
            ? { ...item, targetPrice, alertSent: false, alertSentAt: null }
            : item
        )
      );
      const supabase = createClient();
      try {
        await setWishlistTargetPrice(supabase, {
          userId: user.id,
          productId: product.id,
          retailer: product.retailer,
          targetPrice,
        });
      } finally {
        await refresh();
      }
    },
    [user, refresh]
  );

  const clear = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const toRemove = items;
    setItems([]);
    try {
      await Promise.all(
        toRemove.map((item) =>
          removeFromWishlist(supabase, {
            userId: user.id,
            productId: item.productId,
            retailer: item.retailer,
          })
        )
      );
    } finally {
      await refresh();
    }
  }, [user, items, refresh]);

  const value = useMemo(
    () => ({
      items,
      loading: authLoading || loading,
      isSaved,
      toggle,
      remove,
      clear,
      setTargetPrice,
      count: items.length,
    }),
    [items, authLoading, loading, isSaved, toggle, remove, clear, setTargetPrice]
  );

  return (
    <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return ctx;
}
