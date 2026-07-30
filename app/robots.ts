import type { MetadataRoute } from "next";

const SITE_URL = "https://gopricefinder.com";

/**
 * Disallows the same legacy mock-system and user-account routes excluded
 * from sitemap.ts, for the same reason: no unique indexable content.
 * /products/ (trailing slash) blocks the whole /products/[slug] tree,
 * same for /auth/. /wishlist, /dashboard, /purchases, /search block
 * exactly those routes plus anything nested under them.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/wishlist", "/purchases", "/products/", "/auth/", "/search"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
