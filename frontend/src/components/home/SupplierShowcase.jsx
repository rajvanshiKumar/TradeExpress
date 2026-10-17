import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import Section from "./Section";
import SupplierGrid from "../suppliers/SupplierGrid";
import Image from "../common/Image";
import Button from "../common/Button";
import CompanyLogo from "../common/CompanyLogo";
import VerificationBadge from "../common/VerificationBadge";
import useProducts from "../../hooks/useProducts";
import { formatNumber } from "../../utils/formatCurrency";

/** Supplier discovery: top-rated companies with their verification status shown honestly. */
export default function SupplierShowcase() {
  const { companies, loading } = useProducts();
  const top = useMemo(
    () =>
      companies
        .filter((company) => company.status !== "Suspended")
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 3),
    [companies],
  );
  return (
    <Section
      id="home-suppliers"
      tone="plain"
      className="ts-sage-soft"
      eyebrow="Supplier discovery"
      title="Meet suppliers,"
      accent="not just listings."
      description="Company profiles with location, business type, response time and verification status. Badges reflect admin document reviews on TradeSphere only."
      linkTo="/suppliers"
      linkLabel="Supplier directory"
    >
      <SupplierGrid companies={top} loading={loading} />
    </Section>
  );
}

/** Featured manufacturers in an asymmetric editorial layout. */
export function ManufacturerShowcase() {
  const { companies, products, loading } = useProducts();
  const featured = useMemo(
    () =>
      companies
        .filter(
          (company) =>
            company.status !== "Suspended" &&
            company.businessType === "Manufacturer",
        )
        .map((company) => ({
          company,
          items: products.filter(
            (product) =>
              product.companyId === company.id && product.status === "Active",
          ),
        }))
        .filter((entry) => entry.items.length)
        .sort((a, b) => b.company.rating - a.company.rating)
        .slice(0, 4),
    [companies, products],
  );

  if (featured.length < 2) return null;
  const [lead, ...rest] = featured;

  return (
    <Section
      id="home-manufacturers"
      tone="plain"
      eyebrow="Manufacturers"
      title="Factories with"
      accent="published capacity."
      description="Production-focused suppliers with published minimum orders, lead times and catalogues."
      linkTo="/suppliers?type=Manufacturer"
      linkLabel="All manufacturers"
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_1fr]">
        <article className="group relative isolate flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-[1.75rem] bg-navy-900 p-7 text-white shadow-lift sm:p-9">
          <Image
            photo={lead.company.cover}
            illustration={lead.company.coverIllustration ?? "cover-default"}
            width={1100}
            height={800}
            alt=""
            className="absolute inset-0 -z-10 size-full object-cover transition-transform duration-[1200ms] group-hover:scale-105"
          />
          <div
            className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950 via-navy-950/60 to-navy-950/10"
            aria-hidden="true"
          />
          <div className="flex items-center gap-3">
            <CompanyLogo
              company={lead.company}
              size="lg"
              className="ring-2 ring-white/70"
            />
            <VerificationBadge
              company={lead.company}
              size="md"
              className="bg-white/95"
            />
          </div>
          <h3 className="mt-5 font-display text-3xl font-bold !text-white sm:text-4xl">
            {lead.company.name}
          </h3>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-white/70">
            <MapPin className="size-4" aria-hidden="true" />
            {lead.company.city}, {lead.company.country} · Since{" "}
            {lead.company.established} · {lead.company.employees} staff
          </p>
          <p className="mt-4 max-w-xl text-white/75">
            {lead.company.description}
          </p>
          <ul className="mt-6 flex gap-3">
            {lead.items.slice(0, 4).map((product) => (
              <li key={product.id}>
                <Link
                  to={`/products/${product.slug}`}
                  title={product.name}
                  className="block size-16 overflow-hidden rounded-xl ring-1 ring-white/20 transition-transform hover:-translate-y-1 sm:size-20"
                >
                  <Image
                    photo={product.photo}
                    illustration={product.illustration}
                    width={160}
                    height={160}
                    alt={product.name}
                    className="size-full object-cover"
                  />
                </Link>
              </li>
            ))}
          </ul>
          <Button
            to={`/suppliers/${lead.company.slug}`}
            variant="white"
            iconRight={ArrowRight}
            className="mt-7 self-start"
          >
            View Company
          </Button>
        </article>

        <div className="grid grid-cols-1 gap-5">
          {rest.map(({ company, items }) => (
            <article
              key={company.id}
              className="group flex gap-4 rounded-[1.75rem] bg-[#f1f5ee] p-4 ring-1 ring-navy-900/[0.06] transition-all hover:bg-white hover:shadow-lift sm:p-5"
            >
              <Link
                to={`/suppliers/${company.slug}`}
                tabIndex={-1}
                aria-hidden="true"
                className="relative hidden w-32 shrink-0 overflow-hidden rounded-2xl bg-[#e7efe0] xs:block"
              >
                <Image
                  photo={items[0]?.photo}
                  illustration={items[0]?.illustration}
                  width={260}
                  height={260}
                  alt=""
                  className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CompanyLogo company={company} size="sm" />
                  <VerificationBadge company={company} />
                </div>
                <h3 className="mt-2 font-display text-lg font-bold">
                  <Link
                    to={`/suppliers/${company.slug}`}
                    className="hover:text-brand-600"
                  >
                    {company.name}
                  </Link>
                </h3>
                <p className="text-[0.8125rem] text-muted">
                  {company.flag} {company.city}, {company.country} ·{" "}
                  {company.industry}
                </p>
                <p className="mt-2 text-[0.8125rem] text-ink">
                  {formatNumber(items.length)} products · {company.moqInfo}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}
