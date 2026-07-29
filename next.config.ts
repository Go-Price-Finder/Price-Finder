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
  //
  // Arts & Crafts was later promoted from a category under Toys & Games to
  // its own top-level department (all of Toys & Games' real volume was
  // Arts & Crafts anyway) — /category/toys-games redirects to
  // /category/arts-crafts as a result. The older /category/art-craft-
  // supplies redirect is repointed straight to /category/arts-crafts too,
  // rather than left chaining through toys-games, so that link still
  // resolves in one hop.
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
        destination: "/category/arts-crafts",
        permanent: true,
      },
      {
        source: "/category/toys-games",
        destination: "/category/arts-crafts",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
