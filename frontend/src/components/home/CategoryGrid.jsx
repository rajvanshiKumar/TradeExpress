import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import useProducts from "../../hooks/useProducts";
import { photoUrl, FALLBACK_IMAGE, REAL_HD_IMAGES } from "../../utils/images";

// Curated high-definition photographs for every B2B category & specialty (genuine photography, no cartoons)
const HD_CATEGORY_PHOTOS = {
  electronics: "photo-1498049794561-7780e7231661", // Audio, laptops, smart electronics & accessories
  "fashion-apparel": "photo-1567401893414-76b7b1e5a7a5", // Fashion, textiles & apparel
  "home-kitchen": "photo-1600210492493-0946911123ea", // Premium home & kitchen supplies
  machinery: "photo-1566930665082-4ae9dbbb5b6b", // CNC machinery & industrial manufacturing
  "beauty-personal-care": "photo-1522335789203-aabd1fc54bc9", // Cosmetics & personal care
  packaging: "photo-1534452203293-494d7ddbf7e0", // Packaging boxes & shipping materials
  furniture: "photo-1628744876497-eb30460be9f6", // Commercial & living space furniture
  automotive: "photo-1580273916550-e323be2ae537", // Automotive garage tools & components
  "sports-outdoors": "photo-1575987116913-e96e7d490b8a", // Sports goods & athletic gear
  "toys-games": "photo-1618397360795-952a13220a66", // Wooden toys & games
  agriculture: "photo-1527847263472-aa5338d178b8", // Fresh agricultural harvest & produce
  "industrial-supplies": "photo-1581092921461-eab62e97a780", // Industrial safety gear & plant supplies
  "spec-tools": "photo-1504917599217-d4dc5ebe6122", // Power tools & precision instruments
  "spec-safety": "photo-1581092921461-eab62e97a780", // Safety helmet & PPE equipment
  "spec-packaging": "photo-1513672494107-cd9d848a383e", // Corrugated packaging boxes
  "spec-handtools": "photo-1613206485381-b028e578e791", // Chrome steel hand tools
  "spec-agriculture": "photo-1635574901622-8014a3ddead5", // Agricultural seedlings & farm equipment
  "spec-automotive": "photo-1649136378672-b965cb9935d5", // Auto garage spares & accessories
};

const POPULAR_SPECIALTIES = [
  {
    id: "spec-tools",
    name: "Power Tools & CNC",
    slug: "machinery",
    to: "/products?category=machinery",
    photo: "photo-1504917599217-d4dc5ebe6122",
  },
  {
    id: "spec-safety",
    name: "Safety & PPE Equipment",
    slug: "industrial-supplies",
    to: "/products?category=industrial-supplies",
    photo: "photo-1581092921461-eab62e97a780",
  },
  {
    id: "spec-packaging",
    name: "Corrugated Packaging",
    slug: "packaging",
    to: "/products?category=packaging",
    photo: "photo-1513672494107-cd9d848a383e",
  },
  {
    id: "spec-handtools",
    name: "Hand Tools & Hardware",
    slug: "industrial-supplies",
    to: "/products?category=industrial-supplies",
    photo: "photo-1613206485381-b028e578e791",
  },
  {
    id: "spec-agriculture",
    name: "Agricultural Supplies",
    slug: "agriculture",
    to: "/products?category=agriculture",
    photo: "photo-1635574901622-8014a3ddead5",
  },
  {
    id: "spec-automotive",
    name: "Auto Garage Spares",
    slug: "automotive",
    to: "/products?category=automotive",
    photo: "photo-1649136378672-b965cb9935d5",
  },
];

export default function CategoryGrid() {
  const { categories, products, loading } = useProducts();

  // Combine standard 12 categories with 6 high-demand specialties for an 18-card grid (6x3)
  const allCards = useMemo(() => {
    const mainList = categories.map((cat) => ({
      id: cat.id || cat.slug,
      name: cat.name,
      slug: cat.slug,
      to: `/categories/${cat.slug}`,
      photo: cat.photo || HD_CATEGORY_PHOTOS[cat.slug],
    }));

    return [...mainList, ...POPULAR_SPECIALTIES].slice(0, 18);
  }, [categories]);

  return (
    <section
      aria-labelledby="trending-categories-title"
      className="relative z-10 w-full pt-4 sm:pt-6 pb-2"
    >
      <div className="ts-container">
        {/* Section Heading over dark-to-light green background */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-2">
            <h2
              id="trending-categories-title"
              className="font-display text-lg sm:text-xl lg:text-2xl font-black tracking-tight text-white"
            >
              Trending on TradeExpress
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold text-white border border-white/20 backdrop-blur-xs">
              <Sparkles className="size-3 text-brand-300" />
              Popular B2B Sectors
            </span>
          </div>

          <Link
            to="/categories"
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-white/90 hover:text-white transition-colors"
          >
            <span>View All Categories</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {/* 6-Column Responsive Grid: Full Images with Title Appearing on the Image from the Bottom Side */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-3.5 md:gap-4">
          {allCards.map((card) => {
            const photoId =
              card.photo ||
              HD_CATEGORY_PHOTOS[card.id] ||
              HD_CATEGORY_PHOTOS[card.slug] ||
              REAL_HD_IMAGES[card.illustration] ||
              "photo-1498049794561-7780e7231661";

            const photoSrc = photoUrl(photoId, 480, 480);

            return (
              <Link
                key={card.id}
                to={card.to}
                className="group relative flex flex-col justify-end overflow-hidden rounded-2xl bg-white aspect-[4/3.8] sm:aspect-[4/3.8] shadow-[0_8px_22px_-3px_rgba(18,63,37,0.15),0_3px_8px_-2px_rgba(18,63,37,0.08)] ring-1 ring-emerald-900/10 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_38px_-4px_rgba(18,63,37,0.26),0_8px_16px_-4px_rgba(18,63,37,0.14)] hover:ring-emerald-500/60"
              >
                {/* Full-bleed Category Real HD Photograph (Full of Card) */}
                <img
                  src={photoSrc}
                  alt={card.name}
                  width="360"
                  height="360"
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                  onError={(e) => {
                    e.currentTarget.src = FALLBACK_IMAGE;
                  }}
                />

                {/* Subtle photo depth overlay */}
                <div
                  className="absolute inset-0 bg-gradient-to-t from-emerald-950/20 via-transparent to-transparent opacity-80"
                  aria-hidden="true"
                />

                {/* Title Appearing Directly on the Image from the Bottom Side */}
                <div className="relative z-10 w-full p-2 sm:p-2.5">
                  <div className="w-full rounded-xl bg-emerald-50/95 backdrop-blur-md border border-emerald-200/80 px-2.5 py-2 text-center shadow-xs transition-all duration-200 group-hover:bg-emerald-100/95 group-hover:border-emerald-400 group-hover:shadow-sm">
                    <span className="block text-xs sm:text-[13px] font-extrabold text-emerald-950 tracking-tight line-clamp-2 leading-snug group-hover:text-emerald-700 transition-colors">
                      {card.name}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
