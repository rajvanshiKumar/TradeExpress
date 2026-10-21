import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Boxes,
  Building2,
  Globe,
  LayoutGrid,
} from "lucide-react";

import Button from "../common/Button";
import Skeleton from "../common/Skeleton";
import SearchForm from "../forms/SearchForm";
import useProducts from "../../hooks/useProducts";

/* Decorative botanical accent */
export function BotanicalAccent({ className = "", opacity = 0.18 }) {
  return (
    <svg
      viewBox="0 0 220 260"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={`ts-botanical ${className}`}
      style={{ opacity }}
    >
      <path
        d="M112 252C108 186 104 120 120 12"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {[
        "M112 210C80 204 52 184 40 150c34 2 62 22 72 60Z",
        "M114 196c30-10 56-32 64-66-32 6-58 30-64 66Z",
        "M110 150C82 140 62 116 58 84c30 6 52 32 52 66Z",
        "M114 136c26-12 46-36 50-66-28 8-48 34-50 66Z",
        "M112 92c-22-12-36-34-36-60 24 8 38 32 36 60Z",
        "M116 80c18-12 30-32 30-56-20 8-30 30-30 56Z",
      ].map((path) => (
        <path key={path} d={path} fill="currentColor" />
      ))}
    </svg>
  );
}

/* Catalogue figures from actual application data */
export function useCatalogueFigures() {
  const { products, companies, categories, loading } = useProducts();

  return useMemo(() => {
    const activeCompanies = companies.filter(
      (company) => company.status !== "Suspended",
    );

    return {
      loading,
      items: [
        {
          icon: Boxes,
          value: products.filter((product) => product.status === "Active")
            .length,
          label: "Wholesale listings",
        },
        {
          icon: Building2,
          value: activeCompanies.length,
          label: "Supplier companies",
        },
        {
          icon: Globe,
          value: new Set(activeCompanies.map((company) => company.country))
            .size,
          label: "Sourcing countries",
        },
        {
          icon: LayoutGrid,
          value: categories.length,
          label: "Product categories",
        },
      ],
    };
  }, [products, companies, categories, loading]);
}

const DEFAULT_HERO_PRODUCT = {
  id: "TS-P-1040",
  sku: "TS-FUR-1040",
  name: "Modern Fabric Sofa",
  slug: "modern-fabric-sofa",
  category: "furniture",
  photo: "/images/modern-fabric-sofa.jpg",
  rating: 4.8,
  reviewCount: 126,
  price: 54995,
  unit: "piece",
  moq: 5,
  stock: 300,
  variants: {
    Fabric: ["Cream", "Forest Green", "Stone"],
  },
};

/* Picks the hero product: Modern Fabric Sofa matching the user's reference design */
function pickFeatured(products) {
  const active = products.filter((product) => product.status === "Active");
  const sofa = active.find(
    (product) =>
      product.name?.toLowerCase().includes("fabric sofa") ||
      product.name?.toLowerCase().includes("modern fabric sofa") ||
      product.slug?.includes("fabric-sofa") ||
      product.slug?.includes("modern-fabric-sofa")
  );
  const more = active
    .filter((product) => product.id !== (sofa?.id ?? DEFAULT_HERO_PRODUCT.id) && product.category === "furniture")
    .slice(0, 3);

  return {
    featured: sofa
      ? {
          ...sofa,
          name: "Modern Fabric Sofa",
          slug: "modern-fabric-sofa",
          photo: "/images/modern-fabric-sofa.jpg",
          price: 54995,
          rating: 4.8,
          reviewCount: 126,
        }
      : DEFAULT_HERO_PRODUCT,
    more,
  };
}

export default function HeroSection() {
  const { products, categories, loading } = useProducts();
  const figures = useCatalogueFigures();

  const { featured, more } = useMemo(() => pickFeatured(products), [products]);
  const heroFeatured = featured || DEFAULT_HERO_PRODUCT;
  const featuredCategory = heroFeatured
    ? categories.find((category) => category.slug === heroFeatured.category)
    : null;
  const shopCategoryHref = featuredCategory
    ? `/categories/${featuredCategory.slug}`
    : "/categories";

  return (
    <section
      aria-labelledby="hero-title"
      className="ts-sage relative isolate flex flex-col justify-center overflow-hidden text-navy-900 min-h-0 lg:h-[calc(100dvh-var(--app-header-height,4.75rem))] lg:min-h-[500px]"
    >
      {/* Background leaves */}
      <BotanicalAccent
        className="absolute -left-12 top-6 -z-10 hidden w-48 -rotate-12 lg:block"
        opacity={0.16}
      />
      <BotanicalAccent
        className="absolute -right-8 -bottom-10 -z-10 w-56 rotate-[18deg]"
        opacity={0.12}
      />
      <BotanicalAccent
        className="absolute right-[36%] -top-12 -z-10 hidden w-36 rotate-[160deg] xl:block"
        opacity={0.09}
      />

      {/* SVG Definitions for the exact organic leaf curve matching user reference */}
      <svg width="0" height="0" className="absolute -z-50 pointer-events-none" aria-hidden="true">
        <defs>
          <clipPath id="hero-leaf-curve" clipPathUnits="objectBoundingBox">
            <path d="M 0.02,0.50 C 0.02,0.25 0.15,0.08 0.36,0.09 C 0.50,0.09 0.58,0.06 0.70,0.01 C 0.84,-0.04 0.97,0.01 1.00,0.15 C 1.02,0.30 1.01,0.70 0.99,0.86 C 0.96,0.97 0.82,0.94 0.66,0.91 C 0.54,0.88 0.43,0.78 0.30,0.90 C 0.16,1.01 0.01,0.74 0.02,0.50 Z" />
          </clipPath>
        </defs>
      </svg>

      <div className="ts-container relative z-10 grid grid-cols-1 items-center gap-8 py-8 sm:py-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8 lg:py-6 xl:gap-14 xl:py-8 2xl:gap-16">
        {/* LEFT: copy, CTAs and search */}
        <div className="ts-page-enter relative z-10 flex flex-col justify-center">
          <h1
            id="hero-title"
            className="mt-0 text-3xl font-extrabold !leading-[1.08] tracking-[-0.04em] sm:text-4xl lg:text-[2.6rem] xl:text-[3.25rem] 2xl:text-[3.75rem]"
          >
            One Platform.
            <br />
            <span className="font-medium text-navy-700">Millions of Business Opportunities.</span>
          </h1>

          <p className="mt-2.5 max-w-lg text-xs leading-relaxed text-navy-900/75 sm:mt-3 sm:text-sm lg:text-[0.9375rem] xl:text-base">
            Browse furniture and everyday products from wholesale suppliers.
            Compare prices, minimum order quantities and lead times, then order
            directly or request a quote.
          </p>

          <div className="mt-4 flex flex-col gap-2.5 xs:flex-row sm:mt-5">
            <Button to="/products" size="md" iconRight={ArrowRight}>
              Explore Products
            </Button>
            <Button
              to={shopCategoryHref}
              size="md"
              variant="outline"
              className="!border-navy-900/15 !bg-white/70 backdrop-blur-xl hover:!bg-white"
            >
              {featuredCategory ? `Shop ${featuredCategory.name}` : "Browse categories"}
            </Button>
          </div>

          <div className="mt-4 max-w-xl sm:mt-5">
            <SearchForm variant="hero" idPrefix="hero-search" />
          </div>

          {/* Live catalogue figures */}
          <dl className="mt-4 grid max-w-xl grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-2.5">
            {figures.items.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex flex-col-reverse rounded-xl bg-white/60 px-2.5 py-2 ring-1 ring-white/70 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/85 sm:rounded-2xl sm:px-3 sm:py-2.5"
                >
                  <dt className="mt-0.5 text-[10px] leading-tight text-navy-900/70 sm:text-[11px]">
                    {item.label}
                  </dt>
                  <dd className="flex items-center gap-1.5 font-display text-lg font-extrabold tracking-tight text-navy-900 sm:text-xl lg:text-2xl">
                    <Icon className="size-3.5 text-navy-700 sm:size-4" aria-hidden="true" />
                    {figures.loading && !item.value ? (
                      <Skeleton className="h-6 w-8 opacity-40 sm:h-7 sm:w-10" />
                    ) : (
                      item.value
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>

        {/* RIGHT: featured product with organic curved frame matching user design */}
        <div className="relative mx-auto flex w-full items-center justify-center lg:justify-end">
          <div className="relative w-full max-w-[22rem] sm:max-w-[26rem] md:max-w-[30rem] lg:max-w-[34rem] xl:max-w-[38rem] 2xl:max-w-[41rem]">
            <div className="relative aspect-[1.32/1] w-full drop-shadow-[0_20px_35px_rgba(11,39,22,0.18)]">
              {/* Product photo inside organic curved frame without any green border */}
              <Link
                to={`/products/${heroFeatured.slug}`}
                className="group absolute inset-0 overflow-hidden bg-[#f4f0e8] transition-transform duration-700"
                style={{
                  clipPath: "url(#hero-leaf-curve)",
                  WebkitClipPath: "url(#hero-leaf-curve)",
                }}
                aria-label={`View ${heroFeatured.name}`}
              >
                <img
                  src={heroFeatured.photo?.startsWith('/') ? heroFeatured.photo : "/images/modern-fabric-sofa.jpg"}
                  alt={heroFeatured.name}
                  className="size-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.src = "/images/modern-fabric-sofa.jpg";
                  }}
                />
              </Link>

              {/* Slogan badge at top of the image */}
              <div className="ts-hero-float-slow absolute top-3 sm:top-5 left-8 sm:left-12 z-20">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-navy-900 shadow-lift ring-1 ring-navy-900/10 backdrop-blur-md sm:px-4 sm:py-2 sm:text-xs">
                  <span className="size-2 rounded-full bg-accent-500 animate-pulse" aria-hidden="true" />
                  Buy Smarter. Trade Better. Grow Bigger.
                </span>
              </div>
            </div>

            {/* More furniture pill floating in corner */}
            <Link
              to={shopCategoryHref}
              className="ts-hero-float-slow absolute -right-2 bottom-3 z-20 hidden items-center gap-2 rounded-full bg-white/95 py-1.5 pl-2 pr-3.5 shadow-lift ring-1 ring-navy-900/5 backdrop-blur transition-transform hover:-translate-y-0.5 hover:bg-white sm:flex"
            >
              <span className="flex -space-x-2">
                <img
                  src="/images/furniture-thumb-1.jpg"
                  alt=""
                  className="size-7 rounded-full object-cover ring-2 ring-white"
                />
                <img
                  src="/images/furniture-thumb-2.jpg"
                  alt=""
                  className="size-7 rounded-full object-cover ring-2 ring-white"
                />
                <img
                  src="/images/furniture-thumb-3.jpg"
                  alt=""
                  className="size-7 rounded-full object-cover ring-2 ring-white"
                />
              </span>
              <span className="text-[11px] font-bold text-navy-900 sm:text-xs">
                More furniture
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Seamless organic dual-wave transition into post-banner section */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 w-full overflow-hidden leading-none"
      >
        <svg
          viewBox="0 0 1440 68"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-full sm:h-11 lg:h-13"
          preserveAspectRatio="none"
        >
          <path
            d="M0,22 C320,56 840,4 1440,32 L1440,68 L0,68 Z"
            fill="#eaf2e5"
            fillOpacity="0.55"
          />
          <path
            d="M0,36 C380,68 960,16 1440,44 L1440,68 L0,68 Z"
            fill="#eaf2e5"
          />
          <path
            d="M0,36 C380,68 960,16 1440,44"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </div>
    </section>
  );
}
