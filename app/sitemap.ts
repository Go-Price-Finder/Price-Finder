import type { MetadataRoute } from "next";
import {
  PARTNERS,
  getAllRealProducts,
  getRealCategories,
  getPopulatedCategoryPaths,
} from "@/lib/partners";

const SITE_URL = "https://gopricefinder.com";

/**
 * Auto-generated from the same real-data functions every page already
 * uses (lib/partners.ts) — a partner or product added via
 * scripts/import-partner.mjs is picked up here with no separate update,
 * same as every other consumer of that file. Legacy mock-system routes
 * (/dashboard, /wishlist, /purchases, /products/[slug], /auth/*, /search)
 * are intentionally excluded — see robots.ts, which disallows the same
 * set for the same reason: no unique indexable content.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/categories`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/deals`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/trending`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/how-it-works`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/affiliate-disclosure`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const departmentPages: MetadataRoute.Sitemap = getRealCategories().map((category) => ({
    url: `${SITE_URL}/category/${category.slug}`,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const leafPages: MetadataRoute.Sitemap = getPopulatedCategoryPaths().map(({ deptSlug, path }) => ({
    url: `${SITE_URL}/category/${deptSlug}/${path.join("/")}`,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  const partnerPages: MetadataRoute.Sitemap = PARTNERS.map((partner) => ({
    url: `${SITE_URL}${partner.href}`,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  const productPages: MetadataRoute.Sitemap = getAllRealProducts().map((product) => ({
    url: `${SITE_URL}${product.href}`,
    changeFrequency: "daily",
    priority: 0.5,
  }));

  return [...staticPages, ...departmentPages, ...leafPages, ...partnerPages, ...productPages];
}
