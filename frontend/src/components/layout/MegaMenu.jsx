import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Boxes,
  Building2,
  ChevronRight,
  FileText,
  Sparkles,
} from "lucide-react";
import useProducts from "../../hooks/useProducts";
import Image from "../common/Image";

/**
 * Centered, compact Desktop Categories Mega Menu.
 * Sized to never touch the viewport bottom, perfectly centered on the screen,
 * and displaying all categories, subcategories, image preview and quick links.
 */
export default function MegaMenu({ id, onNavigate }) {
  const { categories, products } = useProducts();
  const [activeSlug, setActiveSlug] = useState(categories[0]?.slug ?? "");

  useEffect(() => {
    if (!categories.some((item) => item.slug === activeSlug)) {
      setActiveSlug(categories[0]?.slug ?? "");
    }
  }, [categories, activeSlug]);

  const active = categories.find((item) => item.slug === activeSlug);
  const count = (slug) =>
    (products || []).filter(
      (product) => product.category === slug && product.status === "Active"
    ).length;

  if (!categories.length) return null;

  return (
    <div
      id={id}
      className="ts-dropdown-anim-center fixed left-1/2 -translate-x-1/2 top-[4.25rem] z-50 w-[min(50rem,calc(100vw-3rem))] max-h-[min(29rem,calc(100vh-5.5rem))] flex flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white/98 backdrop-blur-2xl text-slate-900 shadow-[0_24px_56px_-12px_rgba(11,39,22,0.24),0_0_0_1px_rgba(0,0,0,0.06)]"
    >
      {/* Top Emerald Accent Line */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-transparent via-emerald-600/70 to-transparent"
        aria-hidden="true"
      />

      {/* Main Grid: Navigator Rail & Details */}
      <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-[14.5rem_1fr]">
        {/* Left Navigator Rail */}
        <div className="border-r border-slate-100 bg-slate-50/60 p-2.5 flex flex-col min-h-0">
          <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
            Wholesale Categories
          </div>

          <ul className="flex-1 overflow-y-auto space-y-0.5 pr-1 ts-no-scrollbar">
            {categories.map((category) => {
              const isActive = category.slug === activeSlug;
              return (
                <li key={category.id}>
                  <Link
                    to={`/categories/${category.slug}`}
                    onClick={onNavigate}
                    onMouseEnter={() => setActiveSlug(category.slug)}
                    onFocus={() => setActiveSlug(category.slug)}
                    className={`group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-all duration-150 ${
                      isActive
                        ? "bg-emerald-50 text-emerald-950 border border-emerald-300/80 shadow-2xs"
                        : "text-slate-700 hover:bg-white hover:text-slate-900 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`flex size-5.5 items-center justify-center rounded-lg text-xs shrink-0 transition-colors ${
                          isActive
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-200/80 text-slate-600 group-hover:bg-slate-300"
                        }`}
                      >
                        <Boxes className="size-3" />
                      </span>
                      <span className="truncate">{category.name}</span>
                    </div>

                    <ChevronRight
                      className={`size-3 shrink-0 transition-transform ${
                        isActive
                          ? "text-emerald-700 translate-x-0.5"
                          : "text-slate-300 group-hover:text-slate-500"
                      }`}
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right Active Category Content Area */}
        {active ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col justify-between ts-no-scrollbar">
            <div>
              {/* Category Header with Live Count Badge */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/80 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800 shadow-2xs">
                    <Sparkles className="size-2.5" />
                    <span>{count(active.slug)} Listings</span>
                  </span>
                  <h3 className="mt-1 text-lg font-extrabold tracking-tight text-slate-900 font-display">
                    {active.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                    {active.description}
                  </p>
                </div>

                {/* Compact Thumbnail Image */}
                <Link
                  to={`/categories/${active.slug}`}
                  onClick={onNavigate}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="group relative size-20 sm:size-24 shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100 shadow-2xs hover:shadow-sm transition-all"
                >
                  <Image
                    photo={active.photo}
                    illustration={active.illustration}
                    width={180}
                    height={180}
                    alt={active.name}
                    className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-60" />
                </Link>
              </div>

              {/* Subcategories Grid */}
              <div className="mt-3.5">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Popular Subcategories
                </h4>
                <div className="grid grid-cols-2 gap-1.5">
                  {(active.subcategories || []).slice(0, 8).map((sub) => (
                    <Link
                      key={sub}
                      to={`/products?category=${active.slug}&sub=${encodeURIComponent(sub)}`}
                      onClick={onNavigate}
                      className="group flex items-center justify-between rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-600/40 hover:bg-emerald-50/70 hover:text-emerald-950 transition-all shadow-2xs"
                    >
                      <span className="truncate">{sub}</span>
                      <ChevronRight className="size-2.5 text-slate-300 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Direct Browse Category Button */}
            <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between">
              <Link
                to={`/categories/${active.slug}`}
                onClick={onNavigate}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white hover:bg-emerald-700 px-3.5 py-1.5 text-xs font-bold transition-all shadow-2xs"
              >
                <span>Browse All {active.name}</span>
                <ArrowRight className="size-3" aria-hidden="true" />
              </Link>

              <span className="text-[11px] font-medium text-slate-400">
                Verified wholesale suppliers
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom Shortcuts Footer Bar */}
      <div className="shrink-0 flex items-center justify-between border-t border-slate-100 bg-slate-50/90 px-5 py-2.5 text-xs">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            to="/suppliers"
            onClick={onNavigate}
            className="inline-flex items-center gap-1.5 font-bold text-slate-700 hover:text-emerald-800 transition-colors"
          >
            <Building2 className="size-3.5 text-emerald-700" />
            <span>Verified Suppliers</span>
          </Link>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <Link
            to="/rfq"
            onClick={onNavigate}
            className="inline-flex items-center gap-1.5 font-bold text-slate-700 hover:text-emerald-800 transition-colors"
          >
            <FileText className="size-3.5 text-emerald-700" />
            <span>Post RFQ</span>
          </Link>
        </div>

        <Link
          to="/categories"
          onClick={onNavigate}
          className="inline-flex items-center gap-1 font-bold text-emerald-800 hover:text-emerald-950 transition-colors"
        >
          <span>All categories</span>
          <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
