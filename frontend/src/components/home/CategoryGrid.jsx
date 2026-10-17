import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import Section from "./Section";
import Image from "../common/Image";
import Skeleton from "../common/Skeleton";
import useProducts from "../../hooks/useProducts";

export function CategoryCard({
  category,
  count,
  large = false,
  className = "",
}) {
  return (
    <Link
      to={`/categories/${category.slug}`}
      className={`group relative isolate block overflow-hidden rounded-[1.75rem] bg-[#e7efe0] shadow-card ring-1 ring-navy-900/5 ${className}`}
    >
      <Image
        photo={category.photo}
        illustration={category.illustration}
        width={large ? 900 : 480}
        height={large ? 900 : 480}
        eager={large}
        alt=""
        className="absolute inset-0 -z-10 size-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.07]"
      />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950/85 via-navy-950/15 to-transparent"
        aria-hidden="true"
      />
      <div
        className={`flex h-full flex-col justify-end ${large ? "p-7" : "p-4 sm:p-5"}`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d6e6c8]">
          {count} {count === 1 ? "listing" : "listings"}
        </p>
        <h3
          className={`mt-1 font-display font-bold !text-white ${large ? "text-2xl sm:text-3xl" : "text-base sm:text-lg"}`}
        >
          {category.name}
        </h3>
        {large ? (
          <p className="mt-2 max-w-sm text-sm text-white/70">
            {category.description}
          </p>
        ) : null}
      </div>
      <span
        className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur transition-all duration-300 group-hover:opacity-100"
        aria-hidden="true"
      >
        <ArrowUpRight className="size-4" />
      </span>
    </Link>
  );
}

/** Popular wholesale categories as an editorial bento grid. */
export default function CategoryGrid() {
  const { categories, products, loading } = useProducts();
  const count = (slug) =>
    products.filter(
      (product) => product.category === slug && product.status === "Active",
    ).length;
  const sorted = [...categories].sort((a, b) => count(b.slug) - count(a.slug));

  return (
    <Section
      id="home-categories"
      className="ts-post-banner relative isolate overflow-hidden"
      eyebrow="Category discovery"
      title="Shop wholesale"
      accent="by category."
      description="Sourcing categories with subcategories, minimum order quantities and tiered pricing, all from the live catalogue."
      linkTo="/categories"
      linkLabel="All categories"
    >
      <div
        aria-hidden="true"
        className="ts-grid-pattern absolute inset-0 -z-10 pointer-events-none opacity-40"
      />
      {loading && sorted.length === 0 ? (
        <div
          className="grid grid-cols-2 gap-4 md:grid-cols-4"
          role="status"
          aria-label="Loading categories"
        >
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton
              key={index}
              className="aspect-square w-full rounded-3xl"
            />
          ))}
        </div>
      ) : (
        <div className="grid auto-rows-[10.5rem] grid-cols-2 gap-3 sm:auto-rows-[12rem] sm:gap-4 md:grid-cols-4 lg:auto-rows-[13.5rem]">
          {sorted.slice(0, 12).map((category, index) => (
            <CategoryCard
              key={category.id}
              category={category}
              count={count(category.slug)}
              large={index === 0}
              className={
                index === 0
                  ? "col-span-2 row-span-2"
                  : index === 3
                    ? "md:col-span-2"
                    : index === 11
                      ? "max-md:col-span-2"
                      : ""
              }
            />
          ))}
        </div>
      )}
    </Section>
  );
}
