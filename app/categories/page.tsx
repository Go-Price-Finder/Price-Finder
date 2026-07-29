import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ChevronRightIcon, ChevronDownIcon } from "@/components/icons";
import { getAllRealProducts, slugifyRealCategory } from "@/lib/partners";
import { mapProductToCategory } from "@/lib/category-mapper";
import taxonomy from "@/config/walmart-taxonomy.json";

export const metadata: Metadata = {
  title: "Categories — Price Finder",
  description:
    "Browse Price Finder's full category taxonomy, department by department.",
};

/**
 * Product counts are computed live against the CURRENT real catalog only
 * (lib/partners.ts's getAllRealProducts(), the 449 already-live products)
 * via lib/category-mapper.ts — not the four new-partner feeds tested
 * separately, which are explicitly not being imported yet.
 *
 * This taxonomy IS what /category/[slug] runs on now (Stage 4), at the
 * department level specifically — the deepest level with its own real
 * page. Stage 5 connects the two: a populated department here gets a
 * "View all products" link straight to its /category/[slug] page,
 * generated via the same slugifyRealCategory() that page's data layer
 * uses, so the two can't drift on what a department's slug is. Category/
 * productTypeGroup/productType levels stay display-only — there's no
 * dedicated page for them to link to.
 *
 * Categories with zero products are shown, not hidden, and marked "Coming
 * soon" — this taxonomy is meant to be the complete structure everything
 * eventually maps into, so hiding the empty parts would undersell what
 * it's actually for. They deliberately don't link anywhere: /category/
 * [slug] can't even resolve a department that has no products yet, so a
 * link would be a dead end. Revisit once a partner actually populates one.
 */
function computeCounts() {
  const deptCounts = new Map<string, number>();
  const catCounts = new Map<string, number>();
  const ptgCounts = new Map<string, number>();
  const ptCounts = new Map<string, number>();

  for (const product of getAllRealProducts()) {
    const mapping = mapProductToCategory({
      title: product.name,
      description: product.description,
      brand: product.partnerName,
      partnerCategory: product.category,
      price: product.price,
      url: product.deepLink,
      partnerId: product.partnerId,
    });
    if (mapping.department === "Unclassified") continue;
    deptCounts.set(mapping.department, (deptCounts.get(mapping.department) ?? 0) + 1);
    catCounts.set(mapping.category, (catCounts.get(mapping.category) ?? 0) + 1);
    ptgCounts.set(mapping.productTypeGroup, (ptgCounts.get(mapping.productTypeGroup) ?? 0) + 1);
    ptCounts.set(mapping.productType, (ptCounts.get(mapping.productType) ?? 0) + 1);
  }

  return { deptCounts, catCounts, ptgCounts, ptCounts };
}

export default function CategoriesPage() {
  const { deptCounts, catCounts, ptgCounts, ptCounts } = computeCounts();

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-5 pt-6 sm:px-8">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-ivory-400">
            <Link href="/" className="transition-colors hover:text-gilt-400">
              Home
            </Link>
            <ChevronRightIcon className="h-3 w-3" />
            <span className="text-ivory-200">Categories</span>
          </nav>
        </div>

        <section className="mx-auto max-w-5xl px-5 pb-2 pt-6 text-center sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Categories
          </span>
          <h1 className="mt-2 text-balance font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            Browse everything Price Finder tracks
          </h1>
          <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
          <p className="mx-auto mt-3 max-w-2xl text-balance text-ivory-300">
            Our full category structure, department by department — built
            to scale as we add more partners. Categories with no products
            yet are marked &ldquo;Coming soon&rdquo; rather than hidden,
            since this is the complete structure everything will eventually
            fill in.
          </p>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
          <div className="flex flex-col gap-3">
            {taxonomy.departments.map((dept) => {
              const deptTotal = deptCounts.get(dept.name) ?? 0;
              return (
                <details
                  key={dept.id}
                  className="group overflow-hidden rounded-3xl border border-gilt-500/25 bg-noir-800 shadow-soft"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
                    <span className="font-display text-xl font-semibold text-ivory-50">
                      {dept.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span
                        className={`text-xs font-semibold ${
                          deptTotal > 0 ? "text-gilt-400" : "text-ivory-400"
                        }`}
                      >
                        {deptTotal > 0 ? `${deptTotal} products` : "Coming soon"}
                      </span>
                      {deptTotal > 0 && (
                        // A distinct clickable target from the <summary> row
                        // itself (which toggles the accordion) — nesting a
                        // navigation link inside the toggle would make
                        // clicking near the department name unexpectedly
                        // leave the page instead of expanding it.
                        <Link
                          href={`/category/${slugifyRealCategory(dept.name)}`}
                          className="whitespace-nowrap text-xs font-semibold text-gilt-400 underline decoration-gilt-500/40 underline-offset-2 transition-colors hover:text-gilt-300"
                        >
                          View all products →
                        </Link>
                      )}
                      <ChevronDownIcon className="h-4 w-4 text-ivory-400 transition-transform duration-200 group-open:rotate-180" />
                    </span>
                  </summary>

                  <div className="flex flex-col gap-6 border-t border-gilt-500/15 px-5 pb-6 pt-5">
                    {dept.categories.map((cat) => {
                      const catTotal = catCounts.get(cat.name) ?? 0;
                      return (
                        <div key={cat.id}>
                          <div className="mb-2 flex items-baseline justify-between gap-2">
                            <h3 className="font-display text-base font-semibold text-ivory-50">
                              {cat.name}
                            </h3>
                            <span
                              className={`text-[11px] font-medium ${
                                catTotal > 0 ? "text-gilt-400" : "text-ivory-400"
                              }`}
                            >
                              {catTotal > 0 ? `${catTotal} products` : "Coming soon"}
                            </span>
                          </div>

                          <div className="flex flex-col gap-3">
                            {cat.productTypeGroups.map((ptg) => {
                              const ptgTotal = ptgCounts.get(ptg.name) ?? 0;
                              return (
                                <div key={ptg.id}>
                                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ivory-400">
                                    {ptg.name}
                                    {ptgTotal > 0 ? ` (${ptgTotal})` : ""}
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {ptg.productTypes.map((pt) => {
                                      const count = ptCounts.get(pt) ?? 0;
                                      return (
                                        <span
                                          key={pt}
                                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                                            count > 0
                                              ? "border-gilt-500/30 bg-gilt-500/10 text-ivory-100"
                                              : "border-noir-600 text-ivory-400"
                                          }`}
                                        >
                                          {pt}
                                          {count > 0 ? ` (${count})` : " — Coming soon"}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
