import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import Section from "./Section";
import Image from "../common/Image";
import useProducts from "../../hooks/useProducts";

// Industries highlighted on the homepage, mapped to existing catalogue categories.
const INDUSTRIES = [
  { name: "Textiles & Apparel", category: "fashion-apparel" },
  { name: "Electronics", category: "electronics" },
  { name: "Industrial Machinery", category: "machinery" },
  { name: "Packaging", category: "packaging" },
  { name: "Home Goods", category: "home-kitchen" },
  { name: "Beauty Products", category: "beauty-personal-care" },
];

/** Image-led industry cards linking to the matching catalogue categories. */
export default function IndustrySection() {
  const { categories, products, loading } = useProducts();
  const industries = useMemo(
    () =>
      INDUSTRIES.map((industry) => {
        const category = categories.find(
          (item) => item.slug === industry.category,
        );
        return category
          ? {
              ...industry,
              category,
              count: products.filter(
                (product) =>
                  product.category === category.slug &&
                  product.status === "Active",
              ).length,
            }
          : null;
      }).filter(Boolean),
    [categories, products],
  );

  if (loading || !industries.length) return null;
  return (
    <Section
      id="home-industries"
      tone="white"
      eyebrow="Industries"
      title="Built for every"
      accent="supply chain."
      description="Jump straight into the industries international buyers source from most."
    >
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {industries.map((industry) => (
          <li key={industry.name}>
            <Link
              to={`/categories/${industry.category.slug}`}
              className="group block overflow-hidden rounded-[1.75rem] bg-[#f1f5ee] ring-1 ring-navy-900/[0.06] transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-lift"
            >
              <span className="block overflow-hidden bg-[#e7efe0]">
                <Image
                  photo={industry.category.photo}
                  illustration={industry.category.illustration}
                  width={640}
                  height={400}
                  alt={`${industry.name} products`}
                  className="aspect-[16/10] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </span>
              <span className="flex items-center gap-4 p-5">
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-bold text-navy-900">
                    {industry.name}
                  </span>
                  <span className="text-sm text-muted">
                    {industry.count} wholesale{" "}
                    {industry.count === 1 ? "listing" : "listings"}
                  </span>
                </span>
                <span
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-navy-900 text-white transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  aria-hidden="true"
                >
                  <ArrowUpRight className="size-4" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
