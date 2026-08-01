import type { MetadataRoute } from "next";

const SITE_URL = "https://gopricefinder.com";

/**
 * Disallows the same account/auth routes excluded from sitemap.ts, for the
 * same reason: no unique indexable content. /auth/ (trailing slash) blocks
 * the whole /auth/* tree. /dashboard and /purchases now permanently
 * redirect to /wishlist (see next.config.ts) and /products/ 404s (the
 * legacy mock catalog was removed) — kept disallowed anyway so crawlers
 * don't bother following either.
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
