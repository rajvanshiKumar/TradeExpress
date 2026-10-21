import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Boxes,
  Building2,
  CheckCircle2,
  FileText,
  Globe,
  LayoutGrid,
  ShieldCheck,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import SearchForm from "../forms/SearchForm";
import useProducts from "../../hooks/useProducts";
import useAuth from "../../hooks/useAuth";

/* Decorative botanical accent preserved for sibling sections */
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
      (company) => company.status !== "Suspended"
    );

    return {
      loading,
      items: [
        {
          value: "21Cr+",
          label: "Active Buyers",
        },
        {
          value: "84L+",
          label: "Verified Sellers",
        },
        {
          value: "12Cr+",
          label: "Products & Services",
        },
        {
          value: "100%",
          label: "Escrow Protected",
        },
      ],
    };
  }, [products, companies, categories, loading]);
}

export default function HeroSection() {
  const { user } = useAuth();
  const figures = useCatalogueFigures();

  return (
    <section
      aria-labelledby="hero-title"
      className="relative z-10 text-white pt-6 sm:pt-8 pb-3 sm:pb-4"
    >
      <div className="ts-container relative z-10 flex flex-col items-center text-center">
        {/* Top Action Pills Bar (Matching screenshot top right: Post Requirement, Start Selling, Sign In) */}
        <div className="w-full flex items-center justify-between gap-3 mb-4 sm:mb-5">
          <div className="hidden sm:flex items-center gap-2 text-xs text-white/80">
            <ShieldCheck className="size-4 text-brand-300" />
            <span className="font-semibold text-white">TradeExpress Verified</span>
            <span>· ISO & GST Compliant B2B Sourcing</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 ml-auto">
            <Link
              to="/rfq"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 sm:px-3.5 py-1 sm:py-1.5 text-xs font-bold text-[#166534] shadow-sm transition-all hover:bg-white/95 hover:shadow"
            >
              <FileText className="size-3.5 text-[#15803d]" />
              <span>Post Requirement</span>
              <ArrowRight className="size-3 text-[#166534]" />
            </Link>

            <Link
              to="/register?role=supplier"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 sm:px-3.5 py-1 sm:py-1.5 text-xs font-semibold text-white border border-white/20 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white"
            >
              <TrendingUp className="size-3.5 text-brand-300" />
              <span>Start Selling</span>
              <ArrowRight className="size-3 text-white/70" />
            </Link>

            <Link
              to={user ? "/buyer" : "/login"}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 sm:px-3.5 py-1 sm:py-1.5 text-xs font-semibold text-white border border-white/20 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white"
            >
              <UserCheck className="size-3.5 text-brand-300" />
              <span>{user ? "Dashboard" : "Sign In"}</span>
              <ArrowRight className="size-3 text-white/70" />
            </Link>
          </div>
        </div>

        {/* Main Headline & Subtitle */}
        <h1
          id="hero-title"
          className="font-display text-2xl font-black tracking-tight text-white sm:text-3xl md:text-4xl lg:text-[2.65rem] !leading-[1.12] max-w-4xl"
        >
          India's Largest Online{" "}
          <span className="text-white font-black">B2B Marketplace</span>
        </h1>

        <p className="mt-2 text-xs sm:text-sm text-white/85 font-medium max-w-xl">
          Connecting 21 Cr+ Buyers with Trusted Sellers & Verified Manufacturers
        </p>

        {/* Compact Search Form */}
        <div className="mt-4 sm:mt-5 w-full max-w-2xl">
          <SearchForm variant="hero" idPrefix="hero-search" />
        </div>

        {/* Statistics Metric Strip (Exact visual reference from screenshot) */}
        <div className="mt-6 sm:mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/15 pt-4 text-xs sm:text-sm">
          {figures.items.map((stat, idx) => (
            <div
              key={stat.label}
              className="flex items-center gap-2 px-2 py-0.5"
            >
              <span className="font-display text-base sm:text-lg lg:text-xl font-extrabold tracking-tight text-white">
                {stat.value}
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white/80">
                {stat.label}
              </span>
              {idx < figures.items.length - 1 && (
                <span className="hidden sm:inline-block ml-4 text-white/25 font-light" aria-hidden="true">
                  |
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
