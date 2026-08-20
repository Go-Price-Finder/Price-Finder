import Link from "next/link";
import { getPartners } from "@/lib/catalog";

/**
 * "Our Partners" / "Featured Shops" — a grid of the real retailers Price
 * Finder actually works with, right below Hero. Reads from
 * lib/catalog.ts (Step 14 batch 5), so a new partner shows up here automatically the
 * moment it's added to the catalog — nothing in this component needs
 * to change. No real logo art exists for any partner yet, so each card
 * renders a styled wordmark instead of a fabricated logo image.
 */
export default async function OurPartners() {
  const partners = await getPartners();
  if (partners.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="mb-8 text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-ivory-50">
          Our Partners
        </span>
        <h2 className="mt-2 font-display text-4xl font-medium tracking-tight text-ivory-50 sm:text-5xl">
          Shops we work with
        </h2>
        <span aria-hidden className="mx-auto mt-4 block h-[3px] w-14 rounded-full bg-gilt-500" />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {partners.map((partner) => (
          <Link
            key={partner.id}
            href={partner.href}
            className="group flex flex-col gap-4 rounded-3xl border border-gilt-500/25 bg-noir-800 p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-xl"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gilt-500/15 font-display text-lg font-semibold text-ivory-50">
                {partner.name
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold text-ivory-50 transition-colors group-hover:text-ivory-50">
                  {partner.name}
                </h3>
                <span className="text-xs font-medium text-ivory-400">
                  {partner.products.length} product
                  {partner.products.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-ivory-300">
              {partner.tagline}
            </p>
            <span className="mt-auto text-sm font-medium text-ivory-50">
              Shop {partner.name} →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
