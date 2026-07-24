import type { Metadata } from "next";
import CategoryPageTemplate from "@/components/CategoryPageTemplate";
import { trendingProducts, getDiscountPct } from "@/lib/data";

export const metadata: Metadata = {
  title: "Deals — Price Finder",
  description: "The biggest price drops we're currently tracking, all in one place.",
};

// Only products with a genuine, meaningful price drop count as a "deal" —
// matches the build spec's price_drop > 15% threshold.
const DEAL_THRESHOLD_PCT = 15;

export default function DealsPage() {
  const dealProducts = trendingProducts.filter(
    (product) => getDiscountPct(product) > DEAL_THRESHOLD_PCT
  );

  return (
    <CategoryPageTemplate
      eyebrow="Deals"
      title="Best deals"
      description={`Every product currently priced more than ${DEAL_THRESHOLD_PCT}% below its recent high — the biggest price drops we're tracking right now.`}
      products={dealProducts}
      emptyMessage="No deals over 15% off right now — check back soon, or browse everything that's trending."
    />
  );
}
