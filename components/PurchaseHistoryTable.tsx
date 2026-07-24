import Link from "next/link";
import { formatLongDate, formatPrice, getRetailer } from "@/lib/data";
import { ChevronRightIcon } from "@/components/icons";
import ProductImagePlaceholder from "@/components/ProductImagePlaceholder";
import type { Retailer } from "@/lib/supabase/database.types";

export type PurchaseRow = {
  id: string;
  retailer: Retailer;
  amount_spent: number;
  purchased_at: string;
  products: { id: string; name: string; image_url: string | null } | null;
};

/**
 * Shared purchase-history table — used by both the dashboard summary and
 * the dedicated /purchases page so the two never drift out of sync.
 */
export default function PurchaseHistoryTable({
  purchases,
}: {
  purchases: PurchaseRow[];
}) {
  if (purchases.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-gilt-500/25 bg-noir-800/50 px-6 py-16 text-center">
        <p className="font-display text-lg font-medium text-ivory-50">
          No purchases yet
        </p>
        <p className="max-w-sm text-sm text-ivory-300">
          Once you click &quot;View Deal&quot; on a product, it&apos;ll show
          up here with the retailer and price at the time.
        </p>
        <Link
          href="/#trending"
          className="group mt-1 inline-flex items-center gap-1 rounded-full bg-gilt-500 px-5 py-2.5 text-sm font-medium text-ivory-50 transition-colors hover:bg-gilt-400"
        >
          Browse trending products
          <ChevronRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-gilt-500/25 bg-noir-800 shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-gilt-500/25 bg-noir-800/50 text-xs font-semibold uppercase tracking-wide text-ivory-300">
              <th className="px-5 py-3 font-semibold">Product</th>
              <th className="px-5 py-3 font-semibold">Retailer</th>
              <th className="px-5 py-3 font-semibold">Amount</th>
              <th className="px-5 py-3 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((purchase) => {
              const retailer = getRetailer(purchase.retailer);
              return (
                <tr
                  key={purchase.id}
                  className="border-b border-noir-600 transition-colors last:border-0 hover:bg-noir-700/50"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                        <ProductImagePlaceholder compact />
                      </div>
                      <p className="line-clamp-2 max-w-[220px] font-display text-sm font-medium text-ivory-50">
                        {purchase.products?.name ?? "Unknown product"}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${retailer.badgeClass}`}
                    >
                      {retailer.name}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-display text-sm font-semibold text-price-text">
                    {formatPrice(purchase.amount_spent)}
                  </td>
                  <td className="px-5 py-4 text-sm text-ivory-300">
                    {formatLongDate(purchase.purchased_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
