"use client";

import { useRouter, usePathname } from "next/navigation";
import { useWishlist } from "@/lib/wishlist-context";
import { useAuth } from "@/lib/auth-context";
import { HeartIcon } from "./icons";
import type { WishlistRetailerId } from "@/lib/types";

export default function WishlistButton({
  productId,
  retailer,
  currentPrice,
  className = "",
}: {
  productId: string;
  retailer: WishlistRetailerId;
  currentPrice: number;
  className?: string;
}) {
  const { isSaved, toggle } = useWishlist();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const saved = isSaved(productId);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) {
          router.push(`/auth/login?redirectedFrom=${encodeURIComponent(pathname)}`);
          return;
        }
        toggle({ id: productId, retailer, currentPrice });
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-noir-800/90 text-ivory-100 shadow-soft backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:text-clay-500 active:scale-95 ${
        saved ? "text-clay-500" : ""
      } ${className}`}
    >
      <HeartIcon className="h-[18px] w-[18px]" filled={saved} />
    </button>
  );
}
