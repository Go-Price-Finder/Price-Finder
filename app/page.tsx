import Header from "@/components/Header";
import Hero from "@/components/Hero";
import FutureOfWebsite from "@/components/FutureOfWebsite";
import OurPartners from "@/components/OurPartners";
import LoyaltySection from "@/components/LoyaltySection";
import WhyTrustPrices from "@/components/WhyTrustPrices";
import WhyPriceFinder from "@/components/WhyPriceFinder";
import HowItWorks from "@/components/HowItWorks";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import { buildOrganizationJsonLd } from "@/lib/structured-data";

export default function Home() {
  return (
    <>
      <Header />
      <JsonLd data={buildOrganizationJsonLd()} />
      {/* Section order: Hero (search + stats) → Future of Website (new
          vision statement) → Our Partners → Loyalty → Why Trust Prices →
          Why Price Finder → How It Works.

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
        <Hero />
        <FutureOfWebsite />
        <OurPartners />
        <LoyaltySection />
        <WhyTrustPrices />
        <WhyPriceFinder />
        <HowItWorks />
      </main>
      <Footer />
    </>
  );
}
