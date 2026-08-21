import type { NextConfig } from "next";
import mergedSlugs from "./lib/merged-slugs.json";

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
      // MERGED PRODUCT SLUGS (findings §50). 191 permanent redirects,
      // machine-generated into lib/merged-slugs.json by the collapse, so
      // the map cannot drift from the data files it describes:
      //   26 king-koil RENAMES — the slug now carries the merchant's own
      //      variant name, so the old indexed URL must not 404.
      //    3 king-koil DROPS — aw_product_id absent from the current
      //      feed, variant unnameable; merged into a same-price sibling.
      //  162 canvas-vows DROPS — undifferentiated duplicate titles that
      //      all pointed at ONE merchant URL; merged into the
      //      lowest-priced row of each title group.
      // 301 rather than delete: these are indexed URLs, and handing
      // Google a wall of 404s from a site already struggling to get
      // indexed discards whatever signal they carry. Validated at
      // generation time for orphans, chains, self-redirects and slug
      // collisions — see scripts/check-merged-slugs.mjs, which re-runs
      // that validation on every build.
      ...mergedSlugs.map((r) => ({
        source: r.from,
        destination: r.to,
        permanent: true,
      })),
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
      // Purchase-tracking and loyalty tiers were retired (no real checkout
      // ever fed them — recordPurchaseAction was already disabled/unused),
      // and /dashboard's remaining content (profile card) folded into
      // /wishlist, so both old routes now redirect there.
      {
        source: "/dashboard",
        destination: "/wishlist",
        permanent: true,
      },
      {
        source: "/purchases",
        destination: "/wishlist",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
