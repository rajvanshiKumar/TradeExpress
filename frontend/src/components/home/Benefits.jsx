import {
  BadgeCheck,
  ChartColumn,
  FileText,
  Globe,
  Layers,
  MessageSquare,
  PackagePlus,
  Search,
} from "lucide-react";
import Section from "./Section";
import Button from "../common/Button";
import useAuth from "../../hooks/useAuth";

const BUYERS = [
  {
    icon: Search,
    title: "Search across categories",
    text: "Products, suppliers and company names from one search, with MOQ and price filters.",
  },
  {
    icon: Layers,
    title: "Transparent tiered pricing",
    text: "See what volume does to unit cost before you request a quote.",
  },
  {
    icon: FileText,
    title: "Structured RFQs",
    text: "One request with quantity, specifications and target price, tracked by status.",
  },
  {
    icon: MessageSquare,
    title: "One message centre",
    text: "Supplier conversations, quotes and orders kept together.",
  },
];
const SUPPLIERS = [
  {
    icon: Globe,
    title: "Reach international buyers",
    text: "A company profile with your location, capacity and catalogue.",
  },
  {
    icon: PackagePlus,
    title: "Manage your catalogue",
    text: "Add products with MOQs, price tiers, stock and lead times.",
  },
  {
    icon: BadgeCheck,
    title: "Show your documents",
    text: "Submit business documents for admin review and display the result.",
  },
  {
    icon: ChartColumn,
    title: "Follow performance",
    text: "Orders, inquiries and analytics in one supplier portal.",
  },
];

function Column({ title, items, cta, dark }) {
  return (
    <div
      className={`rounded-[2rem] p-7 sm:p-10 ${dark ? "ts-navy-texture text-white" : "bg-white shadow-card ring-1 ring-navy-900/[0.06]"}`}
    >
      <h3
        className={`font-display text-2xl font-bold ${dark ? "!text-white" : ""}`}
      >
        {title}
      </h3>
      <ul className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.title}>
            <span
              className={`inline-flex size-11 items-center justify-center rounded-full ${dark ? "bg-[#a8c494] text-[#123f25]" : "bg-[#e7efe0] text-navy-900"}`}
            >
              <item.icon className="size-5" aria-hidden="true" />
            </span>
            <h4
              className={`mt-3 font-display text-base font-bold ${dark ? "!text-white" : ""}`}
            >
              {item.title}
            </h4>
            <p
              className={`mt-1 text-sm leading-relaxed ${dark ? "text-white/65" : "text-muted"}`}
            >
              {item.text}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-8">{cta}</div>
    </div>
  );
}

/** Buyer and supplier value propositions (no testimonials: none exist yet). */
export default function Benefits() {
  const { user } = useAuth();
  const isSupplier = user?.role === "supplier";
  const isBuyer = user?.role === "buyer";

  return (
    <Section
      id="home-benefits"
      tone="plain"
      className="ts-sage-soft"
      eyebrow="Why TradeExpress"
      title="Designed for both sides"
      accent="of the deal."
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Column
          title="For buyers"
          items={BUYERS}
          cta={
            isBuyer ? (
              <Button to="/buyer" variant="navy">
                Go to Buyer Dashboard
              </Button>
            ) : isSupplier ? null : (
              <Button to="/register" variant="navy">
                Join as a Buyer
              </Button>
            )
          }
        />
        <Column
          title="For suppliers"
          items={SUPPLIERS}
          dark
          cta={
            isSupplier ? (
              <Button to="/supplier/dashboard" variant="white">
                Go to Supplier Dashboard
              </Button>
            ) : isBuyer ? null : (
              <Button to="/supplier/register" variant="white">
                Join as a Supplier
              </Button>
            )
          }
        />
      </div>
    </Section>
  );
}
