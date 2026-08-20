import Header from "@/components/Header";
import Hero from "@/components/Hero";
import DealShelf, { type ShelfItem } from "@/components/DealShelf";
import FutureOfWebsite from "@/components/FutureOfWebsite";
import OurPartners from "@/components/OurPartners";
import WhyTrustPrices from "@/components/WhyTrustPrices";
import WhyPriceFinder from "@/components/WhyPriceFinder";
import HowItWorks from "@/components/HowItWorks";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import { buildOrganizationJsonLd } from "@/lib/structured-data";
import { getAllRealProducts, getPartners } from "@/lib/catalog";
import { getPriceAsOf, formatAsOfDate } from "@/lib/price-as-of";

export default async function Home() {
  // Computed here (a Server Component) rather than inside Hero (a "use
  // client" component) — importing lib/partners.ts from a client component
  // would bundle its ~1.5MB catalog into client-side JS just for these two
  // numbers. See Hero.tsx's HeroStats comment.
  const heroStats = {
    products: (await getAllRealProducts()).length,
    partners: (await getPartners()).length,
  };

  // DEAL SHELF DATA — real markdowns only, ranked by MARKDOWN DEPTH.
  //
  // Ranking chosen deliberately, because "first N rows" is a ranking
  // nobody picked: the card's own claim is "Marked down by the store", so
  // the only ordering that matches what the card asserts is the size of
  // that markdown. Highest-price would rank by expense, which the card
  // says nothing about, and feed order is not a ranking at all.
  //
  // MEASURED 2026-08-20: exactly ONE product of 1,453 carries a real
  // markdown (originalPrice > price). originalPrice is only ever set when
  // the source feed showed a genuine list price, and most feeds — aaawave's
  // 500 included — leave that column empty. The shelf therefore renders
  // one card today, and the component returns null rather than showing an
  // empty band. Cap is 16 for when that changes.
  const markedDown = (await getAllRealProducts())
    .filter((p) => typeof p.originalPrice === "number" && p.originalPrice > p.price)
    .sort((a, b) => {
      const pa = (a.originalPrice! - a.price) / a.originalPrice!;
      const pb = (b.originalPrice! - b.price) / b.originalPrice!;
      return pb - pa;
    })
    .slice(0, 16);

  const shelfItems: ShelfItem[] = markedDown.map((p) => {
    const iso = getPriceAsOf(p.partnerId, p.slug);
    return {
      id: p.id,
      href: p.href,
      name: p.name,
      image: p.image,
      storeName: p.partnerName,
      price: p.price,
      originalPrice: p.originalPrice ?? null,
      // Rendered verbatim by the card; never inferred. Null for a partner
      // with no known feed vintage, in which case the card omits the line.
      checkedAt: iso ? formatAsOfDate(iso) : null,
      variant: "markdown",
    };
  });

  return (
    <>
      <Header />
      <JsonLd data={buildOrganizationJsonLd()} />
      {/* Section order: Hero (search + stats) → Future of Website (new
          vision statement) → Our Partners → Why Trust Prices →
          Why Price Finder → How It Works.

          Loyalty section was removed — the points/tiers program depended
          on purchase-tracking, which was retired (no live checkout flow
          exists to derive real spend from), so the copy no longer matched
          reality.

          Under Construction and Savings Dashboard were removed — the
          former was stale copy (referenced "first three" partners; we're
          at six now), the latter per explicit request.

          Featured Deals and Best Sellers were removed from the homepage
          per the streamlined redesign — both still exist as their own
          pages (/deals, /trending), which read the same lib/partners.ts
          data functions directly rather than these components.

          Popular Categories ("Browse by category") was also removed —
          replaced by the dedicated /categories page (the full Walmart-
          taxonomy browser), which the nav's "Categories" link now points
          to instead of this page's old #categories anchor. */}
      <main className="flex-1 scroll-smooth snap-y snap-proximity">
        <DealShelf
          items={shelfItems}
          subtitle="The store's own list price against what it charges today — checked daily."
        />
        <Hero stats={heroStats} />
        <FutureOfWebsite products={heroStats.products} partners={heroStats.partners} />
        <OurPartners />
        <WhyTrustPrices />
        <WhyPriceFinder />
        <HowItWorks />
      </main>
      <Footer />
    </>
  );
}
