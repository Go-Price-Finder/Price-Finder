import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ChevronRightIcon, ChevronDownIcon } from "@/components/icons";
import { getAllRealProducts, slugifyRealCategory } from "@/lib/catalog";
import { mapProductToCategory } from "@/lib/category-mapper";
import taxonomy from "@/config/walmart-taxonomy.json";

export const metadata: Metadata = {
  title: "Categories — Go Price Finder",
  description:
    "Browse Go Price Finder's full category taxonomy, department by department.",
};

/**
 * Product counts are computed live against the CURRENT real catalog only
 * (lib/partners.ts's getAllRealProducts(), the 449 already-live products)
 * via lib/category-mapper.ts — not the four new-partner feeds tested
 * separately, which are explicitly not being imported yet.
 *
 * This taxonomy IS what /category/[slug] runs on now (Stage 4), at the
 * department level, and — for a specific product type — the nested
 * /category/[slug]/[...path] page (department > category > productTypeGroup
 * > productType). Category and productTypeGroup levels don't get their
 * own pages; only department and product-type do, so only those two
 * levels are ever links below.
 *
 * Counts below are keyed by full path (pathKey), not by leaf name alone —
 * category/productTypeGroup/productType names collide constantly across
 * the taxonomy ("T-Shirts" appears under 4 different categories, "Wet
 * Palettes" appears twice within the same Arts & Crafts category), so a
 * name-only key would show the same count under every branch that shares
 * that name, whether or not that branch actually has any products. Every
 * lookup below rebuilds the same path used to populate the map, so a
 * given leaf's count always reflects only its own branch.
 *
 * Categories with zero products are shown, not hidden, and marked "Coming
 * soon" — this taxonomy is meant to be the complete structure everything
 * eventually maps into, so hiding the empty parts would undersell what
 * it's actually for. They deliberately don't link anywhere: neither
 * /category/[slug] nor the nested product-type page can resolve a branch
 * that has no products yet, so a link would be a dead end. Revisit once a
 * partner actually populates one.
 */
function pathKey(...parts: string[]): string {
  return parts.join("|||");
}

async function computeCounts() {
  const deptCounts = new Map<string, number>();
  const catCounts = new Map<string, number>();
  const ptgCounts = new Map<string, number>();
  const ptCounts = new Map<string, number>();

  for (const product of await getAllRealProducts()) {
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
    const { department, category, productTypeGroup, productType } = mapping;
    deptCounts.set(department, (deptCounts.get(department) ?? 0) + 1);
    const catKey = pathKey(department, category);
    catCounts.set(catKey, (catCounts.get(catKey) ?? 0) + 1);
    const ptgKey = pathKey(department, category, productTypeGroup);
    ptgCounts.set(ptgKey, (ptgCounts.get(ptgKey) ?? 0) + 1);
    const ptKey = pathKey(department, category, productTypeGroup, productType);
    ptCounts.set(ptKey, (ptCounts.get(ptKey) ?? 0) + 1);
  }

  return { deptCounts, catCounts, ptgCounts, ptCounts };
}

export default async function CategoriesPage() {
  const { deptCounts, catCounts, ptgCounts, ptCounts } = await computeCounts();

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
            Browse everything Go Price Finder tracks
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
                  className="group overflow-hidden rounded-2xl border border-gilt-500/25 bg-noir-800 shadow-soft"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                    <span className="font-display text-xl font-semibold text-ivory-50">
                      {dept.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span
                        className={`text-xs font-semibold ${
                          deptTotal > 0 ? "text-gilt-400" : "text-ivory-400"
                        }`}
                      >
                        {/* "Coming soon" IS A PROMISE, AND IT IS THE
                            LARGEST ONE ON THE SITE (§67). It renders for
                            every taxonomy node with zero products: 682
                            occurrences against 78 real counts on this page
                            as of 2026-08-22, i.e. ~90% of the taxonomy is
                            an undertaking nobody has committed to. The
                            taxonomy is imported wholesale; the products are
                            not. Unlike a flag, nothing here can ever be
                            "flipped on", so this sentence has no expiry and
                            no owner. Registered pending an operator ruling
                            on whether empty nodes should say nothing, be
                            hidden, or keep the promise. */}
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
                      const catTotal = catCounts.get(pathKey(dept.name, cat.name)) ?? 0;
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
                              {/* Same promise as the department row above
                                  (§67) — one ruling covers both. */}
                              {catTotal > 0 ? `${catTotal} products` : "Coming soon"}
                            </span>
                          </div>

                          <div className="flex flex-col gap-3">
                            {cat.productTypeGroups.map((ptg) => {
                              const ptgTotal =
                                ptgCounts.get(pathKey(dept.name, cat.name, ptg.name)) ?? 0;
                              return (
                                <div key={ptg.id}>
                                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ivory-400">
                                    {ptg.name}
                                    {ptgTotal > 0 ? ` (${ptgTotal})` : ""}
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {ptg.productTypes.map((pt) => {
                                      const count =
                                        ptCounts.get(pathKey(dept.name, cat.name, ptg.name, pt)) ?? 0;
                                      const badgeClass = `rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                                        count > 0
                                          ? "border-gilt-500/30 bg-gilt-500/10 text-ivory-100 transition-colors hover:border-gilt-500/60 hover:bg-gilt-500/20"
                                          : "border-noir-600 text-ivory-400"
                                      }`;
                                      if (count === 0) {
                                        return (
                                          <span key={pt} className={badgeClass}>
                                            {pt} — Coming soon
                                          </span>
                                        );
                                      }
                                      const href = `/category/${slugifyRealCategory(dept.name)}/${slugifyRealCategory(cat.name)}/${slugifyRealCategory(ptg.name)}/${slugifyRealCategory(pt)}`;
                                      return (
                                        <Link key={pt} href={href} className={badgeClass}>
                                          {pt} ({count})
                                        </Link>
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
