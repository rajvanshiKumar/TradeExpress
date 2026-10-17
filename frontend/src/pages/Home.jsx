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

  // .ts-home scopes the homepage's sage-and-forest theme (see styles/index.css).
  return (
    <div className="ts-home">
      <HeroSection />
      {error ? (
        <div className="ts-container py-10">
          <div className="ts-card">
            <ErrorState text={error} onRetry={reload} />
          </div>
        </div>
      ) : (
        <>
          <CategoryGrid />
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
