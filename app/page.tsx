import Header from "@/components/Header";
import Hero from "@/components/Hero";
import FutureOfWebsite from "@/components/FutureOfWebsite";
import OurPartners from "@/components/OurPartners";
import UnderConstruction from "@/components/UnderConstruction";
import LoyaltySection from "@/components/LoyaltySection";
import SavingsDashboard from "@/components/SavingsDashboard";
import PopularCategories from "@/components/PopularCategories";
import WhyTrustPrices from "@/components/WhyTrustPrices";
import WhyPriceFinder from "@/components/WhyPriceFinder";
import HowItWorks from "@/components/HowItWorks";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      {/* Section order: Hero (search + stats) → Future of Website (new
          vision statement) → Our Partners → Under Construction → Loyalty
          → Savings Dashboard → Popular Categories → Why Trust Prices →
          Why Price Finder → How It Works.

          Featured Deals and Best Sellers were removed from the homepage
          per the streamlined redesign — both still exist as their own
          pages (/deals, /trending), which read the same lib/partners.ts
          data functions directly rather than these components. */}
      <main className="flex-1 scroll-smooth snap-y snap-proximity">
        <Hero />
        <FutureOfWebsite />
        <OurPartners />
        <UnderConstruction />
        <LoyaltySection />
        <SavingsDashboard />
        <PopularCategories />
        <WhyTrustPrices />
        <WhyPriceFinder />
        <HowItWorks />
      </main>
      <Footer />
    </>
  );
}
