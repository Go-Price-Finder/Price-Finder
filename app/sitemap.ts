import type { MetadataRoute } from "next";
import {
  getPartners,
  getAllRealProducts,
  getRealCategories,
  getPopulatedCategoryPaths,
} from "@/lib/catalog";
import { paginate } from "@/lib/pagination";
import { getAllGuides } from "@/lib/guides";

const SITE_URL = "https://gopricefinder.com";

/**
 * Auto-generated from the same real-data functions every page already
 * uses (lib/catalog.ts since Step 14 batch 5) — a partner or product added via
 * scripts/import-partner.mjs is picked up here with no separate update,
 * same as every other consumer of that file. Account/auth routes
 * (/wishlist, /auth/*, /search) are intentionally excluded — see
 * robots.ts, which disallows the same set for the same reason: no unique
 * indexable content for search engines.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/categories`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/deals`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/trending`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/how-it-works`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/affiliate-disclosure`, changeFrequency: "yearly", priority: 0.2 },
    // Trust pages (2026-08-19).
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.4 },
    // Editorial guides (route approved 2026-08-19): index plus one entry
    // per guide, lastmod = the guide's own lastReviewed frontmatter.
    { url: `${SITE_URL}/stores`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/guides`, changeFrequency: "weekly", priority: 0.5 },
    ...getAllGuides().map((g) => ({
      url: `${SITE_URL}/guides/${g.slug}`,
      lastModified: g.lastReviewed,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    { url: `${SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const partners = await getPartners();

  const departmentPages: MetadataRoute.Sitemap = (await getRealCategories()).map((category) => ({
    url: `${SITE_URL}/category/${category.slug}`,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const leafPages: MetadataRoute.Sitemap = (await getPopulatedCategoryPaths()).map(({ deptSlug, path }) => ({
    url: `${SITE_URL}/category/${deptSlug}/${path.join("/")}`,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  const partnerPages: MetadataRoute.Sitemap = partners.map((partner) => ({
    url: `${SITE_URL}${partner.href}`,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  // Page 2+ of the large-catalog partners paginated at build time (see
  // lib/pagination.ts) — page 1 is already covered by partnerPages above.
  const partnerPaginationPages: MetadataRoute.Sitemap = partners.flatMap((partner) => {
    const { totalPages } = paginate(partner.products, 1);
    return Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => ({
      url: `${SITE_URL}${partner.href}/page/${i + 2}`,
      changeFrequency: "daily" as const,
      priority: 0.5,
    }));
  });

  const productPages: MetadataRoute.Sitemap = (await getAllRealProducts()).map((product) => ({
    url: `${SITE_URL}${product.href}`,
    changeFrequency: "daily",
    priority: 0.5,
  }));

  return [
    ...staticPages,
    ...departmentPages,
    ...leafPages,
    ...partnerPages,
    ...partnerPaginationPages,
    ...productPages,
  ];
}
