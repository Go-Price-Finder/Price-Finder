import SiteHeader, {
  type HeaderCategory,
  type HeaderStore,
} from "./SiteHeader";
import { getAllRealProducts, getPartners, slugifyRealCategory } from "@/lib/catalog";

/**
 * Server wrapper for the operator-delivered SiteHeader (2026-08-19). This
 * file keeps the `Header` name so all ~38 existing `<Header />` call
 * sites swap to the new header without churn.
 *
 * Everything SiteHeader renders is DERIVED HERE from the same catalog
 * functions every page reads (lib/catalog.ts) — nothing hardcoded, so the
 * menu cannot drift from the catalogue: a partner or category that ships
 * via the importer appears here with no separate update, and the §21
 * compliance materialisation applies unchanged (the catalog only ever
 * holds compliance-filtered rows).
 *
 * 2026-08-19 second pass (operator ruling — both integration flags were
 * their errors): signed-in affordances restored (wishlist with live
 * count, account state with sign-out, theme toggle, live-suggestion
 * SearchBar, back button) and the palette rebuilt on the site tokens so
 * the header responds to both themes like every other surface. The one
 * old-header element deliberately NOT restored is the notifications
 * bell: it was a handler-less button — a dead control (§24 family).
 */
export default async function Header() {
  const [partners, products] = await Promise.all([
    getPartners(),
    getAllRealProducts(),
  ]);

  const stores: HeaderStore[] = partners.map((partner) => ({
    id: partner.id,
    name: partner.name,
    href: partner.href,
    tagline: partner.tagline || null,
    logoUrl: partner.logo ?? null,
    productCount: partner.products.length,
  }));

  // Categories are the department level every card/page already uses
  // (parentCategory, mapped once in the catalog layer). storeIds is which
  // partners actually have products in that department — the rail's
  // store panel can therefore never claim a store carries a category it
  // doesn't.
  const byDepartment = new Map<string, { count: number; storeIds: Set<string> }>();
  for (const product of products) {
    const entry = byDepartment.get(product.parentCategory) ?? {
      count: 0,
      storeIds: new Set<string>(),
    };
    entry.count++;
    entry.storeIds.add(product.partnerId);
    byDepartment.set(product.parentCategory, entry);
  }
  const categories: HeaderCategory[] = [...byDepartment.entries()]
    .map(([name, entry]) => ({
      slug: slugifyRealCategory(name),
      name,
      productCount: entry.count,
      storeIds: [...entry.storeIds],
    }))
    .sort((a, b) => b.productCount - a.productCount);

  return <SiteHeader categories={categories} stores={stores} />;
}
