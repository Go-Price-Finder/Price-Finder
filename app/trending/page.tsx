import type { Metadata } from "next";
import CategoryPageTemplate from "@/components/CategoryPageTemplate";
import { trendingProducts } from "@/lib/data";

export const metadata: Metadata = {
  title: "Trending — Price Finder",
  description:
    "Everything that's trending across retailers right now, sorted and filtered your way.",
};

export default function TrendingPage() {
  return (
    <CategoryPageTemplate
      eyebrow="Trending"
      title="Trending products"
      description="A look at what's getting the most attention across the retailers we track."
      products={trendingProducts}
    />
  );
}
