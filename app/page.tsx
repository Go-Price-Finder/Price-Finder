import Header from "@/components/Header";
import Hero from "@/components/Hero";
import OurPartners from "@/components/OurPartners";
import UnderConstruction from "@/components/UnderConstruction";
import FeaturedDeals from "@/components/FeaturedDeals";
import LoyaltySection from "@/components/LoyaltySection";
import BestSellers from "@/components/BestSellers";
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
          (FeaturedDeals, BestSellers) and normal in-page scrolling both
          still work naturally — it nudges toward each section's start
          rather than forcing a hard stop.

          Section order: Hero → Our Partners (new — real retailers we work
          with) → Under Construction (new — sets expectations before the
          real-but-small catalog below) → Featured Deals → Loyalty → Best
          Sellers → Savings Dashboard → Popular Categories → Why Price
          Finder → How It Works. Every section below Hero now either shows
          real data or hides itself entirely when there's nothing real to
          show (FeaturedDeals, BestSellers, PopularCategories). */}
      <main className="flex-1 scroll-smooth snap-y snap-proximity">
        <Hero />
        <OurPartners />
        <UnderConstruction />
        <FeaturedDeals />
        <LoyaltySection />
        <BestSellers />
        <SavingsDashboard />
        <PopularCategories />
        <WhyPriceFinder />
        <HowItWorks />
      </main>
      <Footer />
    </>
  );
}
