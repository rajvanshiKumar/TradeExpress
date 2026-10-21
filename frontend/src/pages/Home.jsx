import HeroSection from "../components/home/HeroSection";
import CategoryGrid from "../components/home/CategoryGrid";
import FeaturedProducts from "../components/home/FeaturedProducts";
import SupplierShowcase, {
  ManufacturerShowcase,
} from "../components/home/SupplierShowcase";
import WholesaleDeals from "../components/home/WholesaleDeals";
import RFQPromo from "../components/home/RFQPromo";
import HowItWorks from "../components/home/HowItWorks";
import IndustrySection from "../components/home/IndustrySection";
import Benefits from "../components/home/Benefits";
import SupplierCTA from "../components/home/SupplierCTA";
import Newsletter from "../components/home/Newsletter";
import ErrorState from "../components/common/ErrorState";
import useProducts from "../hooks/useProducts";
import useDocumentTitle from "../hooks/useDocumentTitle";

export default function Home() {
  const { error, reload } = useProducts();
  useDocumentTitle("");

  return (
    <div className="ts-home">
      {/* Continuous dark-to-light green gradient covering Hero and Category Discovery */}
      <div className="ts-hero-trending-banner relative isolate overflow-hidden w-full">
        {/* Subtle geometric circles & curved lines spanning the entire section */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden select-none"
        >
          {/* Large geometric circle arc cutting through hero and category discovery */}
          <div className="absolute left-1/2 top-[240px] sm:top-[280px] -translate-x-1/2 -translate-y-1/2 size-[700px] sm:size-[920px] lg:size-[1180px] rounded-full border border-white/[0.08]" />
          <div className="absolute left-1/2 top-[240px] sm:top-[280px] -translate-x-1/2 -translate-y-1/2 size-[450px] sm:size-[620px] lg:size-[800px] rounded-full border border-white/[0.05]" />
          <div className="absolute -right-24 -top-24 size-[400px] rounded-full border border-white/[0.06]" />

          {/* Curved geometric orbital arc line */}
          <svg
            viewBox="0 0 1440 700"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0 size-full opacity-20"
            preserveAspectRatio="none"
          >
            <path
              d="M-100,560 C350,180 900,60 1550,420"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <path
              d="M-50,480 C400,120 950,30 1600,340"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1.2"
            />
          </svg>
        </div>

        <HeroSection />
        <CategoryGrid />
      </div>

      {error ? (
        <div className="ts-container py-10">
          <div className="ts-card">
            <ErrorState text={error} onRetry={reload} />
          </div>
        </div>
      ) : (
        <>
          <FeaturedProducts />
          <ManufacturerShowcase />
          <SupplierShowcase />
          <WholesaleDeals />
          <RFQPromo />
          <HowItWorks />
          <IndustrySection />
          <Benefits />
        </>
      )}
      <SupplierCTA />
      <Newsletter />
    </div>
  );
}
