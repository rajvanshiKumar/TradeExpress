import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgePercent,
  CheckCircle2,
  Flame,
  Layers,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import Reveal from "../common/Reveal";

const VALUE_PROPS = [
  {
    icon: BadgePercent,
    badge: "Direct Pricing",
    title: "Volume Factory Tiers",
    desc: "Up to 35% lower unit prices directly from audited manufacturers.",
    stat: "Zero Middlemen",
  },
  {
    icon: Layers,
    badge: "Flexible Sampling",
    title: "Low MOQ Batches",
    desc: "Order sample batches from 5 units before full-scale container orders.",
    stat: "From 5 Units",
  },
  {
    icon: ShieldCheck,
    badge: "Pre-Vetted",
    title: "100% Verified Makers",
    desc: "On-site inspected factories with verified export certifications.",
    stat: "ISO / CE / Audit",
  },
  {
    icon: Truck,
    badge: "Trade Escrow",
    title: "Protected Delivery",
    desc: "Full payment milestone release & insured door-to-door freight.",
    stat: "Insured Transit",
  },
];

const TRENDING_TAGS = [
  { label: "Living Room Seating", query: "seating" },
  { label: "Solid Wood Dining", query: "dining" },
  { label: "Ergonomic Workstations", query: "office" },
  { label: "Architectural Lighting", query: "lighting" },
  { label: "Outdoor & Patio", query: "outdoor" },
  { label: "Hot Wholesale Deals", link: "/products?deal=1", isDeal: true },
];

/**
 * Floating glassmorphic trust and market-pulse banner that sits directly after the hero banner,
 * eliminating the harsh white gap with high-impact factory advantages and interactive category tags.
 */
export default function MarketplaceBridge() {
  return (
    <section className="relative z-20 -mt-6 px-4 sm:-mt-10 sm:px-6 lg:-mt-12 lg:px-8">
      <div className="ts-container">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-white/90 bg-white/85 p-5 shadow-[0_24px_50px_-18px_rgba(18,63,37,0.18)] backdrop-blur-2xl ring-1 ring-navy-900/5 sm:p-7">
            {/* Ambient inner radiance */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-brand-500/15 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-20 -left-20 size-64 rounded-full bg-accent-500/10 blur-3xl"
            />

            {/* 4 Trust & Direct Factory Sourcing Pillars */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {VALUE_PROPS.map((prop) => {
                const Icon = prop.icon;
                return (
                  <div
                    key={prop.title}
                    className="group flex items-start gap-3.5 rounded-2xl border border-navy-900/[0.05] bg-white/70 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/35 hover:bg-white hover:shadow-card"
                  >
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#e7efe0] to-[#d6e6c8] text-navy-900 shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:from-navy-900 group-hover:to-navy-800 group-hover:text-white">
                      <Icon className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                          <CheckCircle2 className="size-3 text-brand-600" aria-hidden="true" />
                          {prop.badge}
                        </span>
                        <span className="rounded-md bg-navy-50 px-1.5 py-0.5 text-[9px] font-bold text-navy-800">
                          {prop.stat}
                        </span>
                      </div>
                      <h4 className="mt-1 font-display text-sm font-extrabold text-navy-900 sm:text-[0.9375rem]">
                        {prop.title}
                      </h4>
                      <p className="mt-0.5 text-xs leading-relaxed text-navy-900/70">
                        {prop.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Trending Tags Bar */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-navy-900/[0.07] pt-4">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-accent-500/15 text-accent-600">
                  <Flame className="size-3.5 fill-accent-500 text-accent-500" aria-hidden="true" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-navy-900">
                  High Demand This Month:
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {TRENDING_TAGS.map((tag) => (
                  <Link
                    key={tag.label}
                    to={tag.link || `/products?q=${encodeURIComponent(tag.query)}`}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
                      tag.isDeal
                        ? "bg-accent-500 text-white shadow-sm hover:bg-accent-600"
                        : "border border-navy-900/10 bg-white/90 text-navy-800 hover:border-brand-500 hover:bg-brand-50 hover:text-navy-950"
                    }`}
                  >
                    {tag.isDeal ? <Sparkles className="size-3" aria-hidden="true" /> : null}
                    {tag.label}
                  </Link>
                ))}
                <Link
                  to="/products"
                  className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-900 hover:underline"
                >
                  All Listings <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
