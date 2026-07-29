import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // Stage 4 of the category-system migration: /category/[slug] switched
  // from the old 5-parent-category system (lib/category-map.ts, retired
  // to _to_delete/) to the Walmart-taxonomy department level. Three of the
  // four old slugs changed as a result — permanent redirects so no
  // bookmarked/linked URL breaks. "apparel-accessories" isn't listed
  // because the old and new systems produce the exact same slug for the
  // exact same 5 products, so that URL needs no redirect. The two old
  // slugs that never had real content (home-living, general-merchandise —
  // always 0 products, so /category/[slug] already 404'd for them) aren't
  // redirected either, since there's nothing real to send them to yet.
  async redirects() {
    return [
      {
        source: "/category/food-kitchen",
        destination: "/category/grocery-food",
        permanent: true,
      },
      {
        source: "/category/ev-charging-accessories",
        destination: "/category/automotive",
        permanent: true,
      },
      {
        source: "/category/art-craft-supplies",
        destination: "/category/toys-games",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
