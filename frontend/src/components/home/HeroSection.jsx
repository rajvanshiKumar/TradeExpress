import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Building2,
  Globe,
  LayoutGrid,
  Sofa,
  Star,
  Zap,
} from "lucide-react";

import Button from "../common/Button";
import Image from "../common/Image";
import Skeleton from "../common/Skeleton";
import SearchForm from "../forms/SearchForm";
import useProducts from "../../hooks/useProducts";
import useCurrency from "../../hooks/useCurrency";
import { getPriceRange } from "../../utils/calculateTotals";

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

/* Picks the hero product from the live catalogue: an active furniture listing with a
   photo (living-room seating first, then highest rated), falling back to any active
   listing with a photo. */
function pickFeatured(products) {
  const active = products.filter((product) => product.status === "Active");
  const seating = (product) => (product.subcategory === "Living Room" ? 1 : 0);
  const byRating = (a, b) => seating(b) - seating(a) || (b.rating ?? 0) - (a.rating ?? 0);
  const furniture = active
    .filter((product) => product.category === "furniture" && product.photo)
    .sort(byRating);
  const featured = furniture[0] ?? active.find((product) => product.photo) ?? active[0] ?? null;
  const more = (furniture.length > 1 ? furniture : active.filter((product) => product.photo))
    .filter((product) => product.id !== featured?.id)
    .slice(0, 3);
  return { featured, more };
}

export default function HeroSection() {
  const { products, categories, loading } = useProducts();
  const { money } = useCurrency();
  const figures = useCatalogueFigures();

  const { featured, more } = useMemo(() => pickFeatured(products), [products]);
  const featuredCategory = featured
    ? categories.find((category) => category.slug === featured.category)
    : null;
  const shopCategoryHref = featuredCategory
    ? `/categories/${featuredCategory.slug}`
    : "/categories";
  const highlight = featured?.readyToShip
    ? { icon: Zap, label: "Ready to ship" }
    : featured?.deal
      ? { icon: null, label: "Volume pricing" }
      : null;

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

      <div className="ts-container relative z-10 grid grid-cols-1 items-center gap-8 py-8 sm:py-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8 lg:py-6 xl:gap-14 xl:py-8 2xl:gap-16">
        {/* LEFT: copy, CTAs and search */}
        <div className="ts-page-enter relative z-10 flex flex-col justify-center">
          <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/70 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-900 ring-1 ring-navy-900/10 backdrop-blur-xl sm:text-xs">
            <Sofa className="size-3.5 text-accent-600 sm:size-4" aria-hidden="true" />
            Furniture, décor &amp; wholesale essentials
          </p>

          <h1
            id="hero-title"
            className="mt-3.5 text-3xl font-extrabold !leading-[1.08] tracking-[-0.04em] sm:text-4xl lg:text-[2.6rem] xl:text-[3.25rem] 2xl:text-[3.75rem]"
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

        {/* RIGHT: featured product */}
        <div className="relative mx-auto flex w-full items-center justify-center lg:justify-end">
          {loading && !featured ? (
            <Skeleton className="mx-auto aspect-square w-full max-w-[18rem] rounded-full opacity-40 sm:max-w-[21rem] lg:max-w-[24rem] xl:max-w-[27rem]" />
          ) : featured ? (
            <div className="relative w-full max-w-[18rem] sm:max-w-[21rem] md:max-w-[23rem] lg:max-w-[24rem] xl:max-w-[27rem] 2xl:max-w-[29rem]">
              <div className="relative aspect-square w-full">
                {/* Organic blob and white disc */}
                <div
                  aria-hidden="true"
                  className="ts-hero-blob absolute inset-[4%] bg-navy-900/90 shadow-pop"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-[9%] rounded-full bg-white/95 shadow-[0_30px_80px_-30px_rgb(11_39_22/0.55)]"
                />

                {/* Product photo */}
                <Link
                  to={`/products/${featured.slug}`}
                  className="group absolute inset-[13%] overflow-hidden rounded-full ring-4 ring-white sm:ring-8"
                  aria-label={`View ${featured.name}`}
                >
                  <Image
                    photo={featured.photo}
                    illustration={featured.illustration}
                    width={720}
                    height={720}
                    eager
                    alt={featured.name}
                    className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                </Link>

                {/* Highlight chip (only when the listing actually has the flag) */}
                {highlight ? (
                  <span className="ts-hero-float-slow absolute right-[2%] top-[8%] z-10 inline-flex items-center gap-1.5 rounded-full bg-accent-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg sm:px-3.5 sm:py-2 sm:text-sm">
                    {highlight.icon ? <highlight.icon className="size-3.5" aria-hidden="true" /> : null}
                    {highlight.label}
                  </span>
                ) : null}

                {/* More from the same category */}
                {more.length ? (
                  <Link
                    to={shopCategoryHref}
                    className="ts-hero-float-slow absolute right-0 bottom-[14%] z-10 hidden items-center gap-2.5 rounded-full bg-white/95 py-1.5 pl-2 pr-3.5 shadow-lift ring-1 ring-navy-900/5 backdrop-blur sm:flex"
                  >
                    <span className="flex -space-x-2.5">
                      {more.map((product) => (
                        <Image
                          key={product.id}
                          photo={product.photo}
                          illustration={product.illustration}
                          width={96}
                          height={96}
                          alt=""
                          className="size-8 rounded-full object-cover ring-2 ring-white"
                        />
                      ))}
                    </span>
                    <span className="text-[11px] font-bold text-navy-900 sm:text-xs">
                      More {featuredCategory ? featuredCategory.name.toLowerCase() : "products"}
                    </span>
                  </Link>
                ) : null}
              </div>

              {/* Featured product card */}
              <div className="ts-hero-float relative z-10 mx-auto -mt-6 w-[min(18rem,94%)] rounded-2xl bg-white p-3.5 shadow-lift ring-1 ring-navy-900/5 sm:absolute sm:-bottom-2 sm:-left-3 sm:mx-0 sm:mt-0 sm:w-[15rem] sm:p-4 xl:w-[16.5rem]">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent-600 sm:text-[11px]">
                  Featured {featuredCategory ? featuredCategory.name.toLowerCase() : "listing"}
                </p>
                <p className="mt-0.5 truncate font-display text-sm font-extrabold text-navy-900 sm:text-base">
                  {featured.name}
                </p>
                {featured.rating ? (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted sm:text-xs">
                    <Star className="size-3 fill-amber-400 text-amber-400 sm:size-3.5" aria-hidden="true" />
                    <span className="font-semibold text-ink">{Number(featured.rating).toFixed(1)}</span>
                    <span className="sr-only">out of 5</span>
                    {featured.reviewCount !== undefined ? <span>({featured.reviewCount})</span> : null}
                  </p>
                ) : null}
                <div className="mt-2.5 flex items-end justify-between gap-2 sm:mt-3">
                  <p className="min-w-0">
                    <span className="font-display text-lg font-extrabold text-navy-900 sm:text-xl">
                      {money(getPriceRange(featured).min)}
                    </span>
                    <span className="text-[11px] text-muted sm:text-xs"> / {featured.unit}</span>
                  </p>
                  <Link
                    to={`/products/${featured.slug}`}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-900 text-white shadow-[var(--shadow-gold)] transition-transform hover:-translate-y-0.5 hover:bg-navy-800 sm:size-10"
                    aria-label={`View ${featured.name}`}
                  >
                    <ArrowUpRight className="size-4 sm:size-4.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>

            </div>
          ) : null}
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
