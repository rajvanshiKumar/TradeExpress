import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, ChevronRight, FileText } from "lucide-react";
import useProducts from "../../hooks/useProducts";
import Image from "../common/Image";

/** Desktop categories panel shown under the "Categories" navigation item. */
export default function MegaMenu({ id, onNavigate }) {
  const { categories, products } = useProducts();
  const [activeSlug, setActiveSlug] = useState(categories[0]?.slug ?? "");

  useEffect(() => {
    if (!categories.some((item) => item.slug === activeSlug))
      setActiveSlug(categories[0]?.slug ?? "");
  }, [categories, activeSlug]);

  const active = categories.find((item) => item.slug === activeSlug);
  const count = (slug) =>
    products.filter(
      (product) => product.category === slug && product.status === "Active",
    ).length;

  if (!categories.length) return null;

  return (
    <div
      id={id}
      className="ts-slide-up absolute left-1/2 top-[calc(100%+0.75rem)] z-40 w-[min(60rem,calc(100vw-4rem))] -translate-x-1/2 overflow-hidden rounded-3xl border border-navy-900/[0.06] bg-white text-ink shadow-pop"
    >
      <div className="grid grid-cols-[17rem_1fr]">
        <ul className="max-h-[28rem] overflow-y-auto border-r py-2">
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                to={`/categories/${category.slug}`}
                onClick={onNavigate}
                onMouseEnter={() => setActiveSlug(category.slug)}
                onFocus={() => setActiveSlug(category.slug)}
                className={`flex items-center justify-between gap-2 px-5 py-2.5 text-sm font-semibold ${category.slug === activeSlug ? "bg-ivory text-navy-900 shadow-[inset_3px_0_0_var(--color-brand-500)]" : "text-ink hover:bg-ivory"}`}
              >
                {category.name}
                <ChevronRight
                  className="size-4 text-muted"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
        {active ? (
          <div className="grid grid-cols-[1fr_13rem] gap-6 p-6">
            <div>
              <p className="ts-eyebrow">{count(active.slug)} products</p>
              <h3 className="mt-1 text-lg font-bold">{active.name}</h3>
              <p className="mt-1 text-sm text-muted">{active.description}</p>
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1">
                {active.subcategories.map((sub) => (
                  <li key={sub}>
                    <Link
                      to={`/products?category=${active.slug}&sub=${encodeURIComponent(sub)}`}
                      onClick={onNavigate}
                      className="block rounded py-1.5 text-sm text-ink hover:text-brand-600"
                    >
                      {sub}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                to={`/categories/${active.slug}`}
                onClick={onNavigate}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                Browse {active.name}{" "}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <Link
              to={`/categories/${active.slug}`}
              onClick={onNavigate}
              tabIndex={-1}
              aria-hidden="true"
              className="block overflow-hidden rounded-xl bg-surface"
            >
              <Image
                photo={active.photo}
                illustration={active.illustration}
                width={420}
                height={420}
                alt=""
                className="aspect-square w-full object-cover"
              />
            </Link>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-ivory px-6 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <Link
            to="/suppliers"
            onClick={onNavigate}
            className="inline-flex items-center gap-1.5 font-semibold text-navy-800 transition-colors hover:text-brand-600"
          >
            <Building2 className="size-4 text-brand-600" />
            Find Verified Suppliers
          </Link>
          <span className="text-navy-300 hidden sm:inline">•</span>
          <Link
            to="/rfq"
            onClick={onNavigate}
            className="inline-flex items-center gap-1.5 font-semibold text-navy-800 transition-colors hover:text-brand-600"
          >
            <FileText className="size-4 text-brand-600" />
            Request for Quotation (RFQ)
          </Link>
        </div>
        <Link
          to="/categories"
          onClick={onNavigate}
          className="inline-flex items-center gap-1.5 font-semibold text-navy-900 transition-colors hover:text-brand-600"
        >
          View all categories
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
