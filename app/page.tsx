import Header from "@/components/Header";
import Hero from "@/components/Hero";
import FutureOfWebsite from "@/components/FutureOfWebsite";
import OurPartners from "@/components/OurPartners";
import WhyTrustPrices from "@/components/WhyTrustPrices";
import WhyPriceFinder from "@/components/WhyPriceFinder";
import HowItWorks from "@/components/HowItWorks";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import { buildOrganizationJsonLd } from "@/lib/structured-data";
import { getAllRealProducts, PARTNERS } from "@/lib/partners";

export default function Home() {
  // Computed here (a Server Component) rather than inside Hero (a "use
  // client" component) — importing lib/partners.ts from a client component
  // would bundle its ~1.5MB catalog into client-side JS just for these two
  // numbers. See Hero.tsx's HeroStats comment.
  const heroStats = {
    products: getAllRealProducts().length,
    partners: PARTNERS.length,
  };

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
        <Hero stats={heroStats} />
        <FutureOfWebsite />
        <OurPartners />
        <WhyTrustPrices />
        <WhyPriceFinder />
        <HowItWorks />
      </main>
      <Footer />
    </>
  );
}
