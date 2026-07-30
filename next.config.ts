import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Trimmed from Next's default 8 deviceSizes (which go up to 3840px) —
    // checked every real next/image usage on the site: product-card grids
    // (the highest-volume usage, appears on every listing page) use
    // 25vw/33vw/50vw sizes and never need more than ~960px even at 3x DPR
    // since every layout is capped at max-w-7xl (1280px); the widest real
    // case (ProductGallery's mobile 100vw hero image at a ~1024px tablet
    // breakpoint, 2x DPR) tops out around 2046px, which the remaining
    // 1920px bucket covers closely enough. Dropping 2048/3840 cuts the
    // size-variant matrix by 25% for image-optimization transformations
    // without affecting real rendered quality. imageSizes intentionally
    // left at the default — both fixed-size usages on the site (the
    // gallery's 64px thumbnails, loyalty-icons' 256px icons) already map
    // cleanly onto it.
    deviceSizes: [384, 640, 750, 828, 1080, 1200, 1920],
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
