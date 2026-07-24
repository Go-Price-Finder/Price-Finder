import Header from "@/components/Header";
import Hero from "@/components/Hero";
import FeaturedDeals from "@/components/FeaturedDeals";
import LoyaltySection from "@/components/LoyaltySection";
import TrendingNow from "@/components/TrendingNow";
import SavingsDashboard from "@/components/SavingsDashboard";
import PopularCategories from "@/components/PopularCategories";
import WhyPriceFinder from "@/components/WhyPriceFinder";
import HowItWorks from "@/components/HowItWorks";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      {/* snap-proximity (not mandatory) so the horizontal product rails
          (FeaturedDeals, TrendingNow) and normal in-page scrolling both
          still work naturally — it nudges toward each section's start
          rather than forcing a hard stop.

          Section order is deliberately varied — full-height "pinned"
          sections (Hero/Loyalty/Trending/Categories/How It Works) are
          interleaved with shorter, content-driven ones (FeaturedDeals,
          SavingsDashboard, WhyPriceFinder) so the page doesn't read as one
          long stack of identical-height blocks. */}
      <main className="flex-1 scroll-smooth snap-y snap-proximity">
        <Hero />
        <FeaturedDeals />
        <LoyaltySection />
        <TrendingNow />
        <SavingsDashboard />
        <PopularCategories />
        <WhyPriceFinder />
        <HowItWorks />
      </main>
      <Footer />
    </>
  );
}
