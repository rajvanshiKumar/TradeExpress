import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Facebook,
  FileText,
  HelpCircle,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Scale,
  ShieldCheck,
  Twitter,
} from 'lucide-react';
import Logo from '../common/Logo';
import ResetDataButton from '../common/ResetDataButton';
import { BRAND } from '../../utils/constants';

function shareLinks() {
  const url = encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '');
  const text = encodeURIComponent(`${BRAND.name} — ${BRAND.tagline}`);
  return [
    { label: 'Share on LinkedIn', icon: Linkedin, href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}` },
    { label: 'Share on X', icon: Twitter, href: `https://twitter.com/intent/tweet?text=${text}&url=${url}` },
    { label: 'Share on Facebook', icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
    { label: 'Share on WhatsApp', icon: MessageCircle, href: `https://wa.me/?text=${text}%20${url}` },
  ];
}

/* Subtle, static leaf-inspired decorative shape (low opacity, zero animation) */
function StaticLeafDecoration({ className = '', opacity = 0.07 }) {
  return (
    <svg
      viewBox="0 0 240 280"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none absolute select-none ${className}`}
      style={{ opacity }}
    >
      <path
        d="M120 270C116 195 110 125 130 15"
        stroke="#123f25"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M120 220C82 212 50 190 38 152c38 2 68 24 82 68Z"
        fill="#123f25"
      />
      <path
        d="M122 205c32-12 60-36 70-74-36 6-64 34-70 74Z"
        fill="#123f25"
      />
      <path
        d="M118 155C86 142 64 116 60 80c32 6 56 34 58 75Z"
        fill="#123f25"
      />
      <path
        d="M122 140c28-14 50-40 54-74-30 8-52 38-54 74Z"
        fill="#123f25"
      />
      <path
        d="M120 95c-24-14-38-38-38-66 26 8 42 36 38 66Z"
        fill="#123f25"
      />
      <path
        d="M124 82c20-14 32-36 32-62-22 8-32 34-32 62Z"
        fill="#123f25"
      />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="relative mt-auto overflow-hidden border-t border-[#d3e3cc] bg-[#edf4e8] text-navy-900">
      {/* Subtle, low-opacity leaf-inspired decorative shapes */}
      <StaticLeafDecoration className="-left-16 -top-12 size-64 -rotate-12" opacity={0.07} />
      <StaticLeafDecoration className="-right-12 -bottom-16 size-72 rotate-[25deg]" opacity={0.06} />
      <StaticLeafDecoration className="left-1/3 -top-20 size-48 rotate-[145deg]" opacity={0.05} />

      <div className="ts-container relative z-10">
        {/* Top CTA Row */}
        <div className="flex flex-col gap-5 border-b border-[#d8e7d2] py-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-display text-xl sm:text-2xl font-black text-navy-950 tracking-tight">
              India's Leading Online <span className="text-brand-700">B2B Marketplace</span>
            </p>
            <p className="mt-1 text-xs sm:text-sm text-navy-800/80">
              Verified wholesale sourcing, quote comparison, and 100% escrow protection.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/rfq"
              className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-navy-800"
            >
              <span>Post Requirement</span>
              <ArrowRight className="size-3.5" />
            </Link>
            <Link
              to="/register?role=supplier"
              className="inline-flex items-center gap-2 rounded-full border border-navy-900/20 bg-white/80 px-5 py-2.5 text-xs font-bold text-navy-900 shadow-xs transition-all hover:bg-white"
            >
              <span>Start Selling</span>
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* 5-Column Organized Content Layout */}
        <div className="grid grid-cols-1 gap-8 py-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {/* Column 1: About */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Logo showTagline={false} />
            <p className="mt-3 text-xs leading-relaxed text-navy-800/85">
              TradeExpress connects verified buyers, wholesale importers, manufacturers, and exporters across India with secure escrow protection.
            </p>

            <div className="mt-4 space-y-1.5 text-xs font-semibold text-emerald-800">
              <p className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-700 shrink-0" />
                <span>Verified GST & KYC Businesses</span>
              </p>
              <p className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-700 shrink-0" />
                <span>100% Escrow Payment Protection</span>
              </p>
            </div>

            <ul className="mt-5 flex gap-2" aria-label="Share TradeExpress">
              {shareLinks().map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    title={item.label}
                    className="inline-flex size-8 items-center justify-center rounded-full border border-navy-900/15 bg-white/80 text-navy-800 shadow-2xs transition-all hover:bg-navy-900 hover:text-white"
                  >
                    <item.icon className="size-3.5" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: Quick Links */}
          <nav aria-label="Quick Links">
            <h2 className="font-display text-xs font-bold uppercase tracking-widest text-navy-950">
              Quick Links
            </h2>
            <ul className="mt-3.5 space-y-2 text-xs">
              <li>
                <Link to="/products" className="text-navy-800/85 hover:text-navy-950 hover:underline transition-colors font-medium">
                  Explore Products
                </Link>
              </li>
              <li>
                <Link to="/categories" className="text-navy-800/85 hover:text-navy-950 hover:underline transition-colors font-medium">
                  All Categories
                </Link>
              </li>
              <li>
                <Link to="/suppliers" className="text-navy-800/85 hover:text-navy-950 hover:underline transition-colors font-medium">
                  Verified Suppliers
                </Link>
              </li>
              <li>
                <Link to="/exporters" className="text-navy-800/85 hover:text-navy-950 hover:underline transition-colors font-medium">
                  Indian Exporters
                </Link>
              </li>
              <li>
                <Link to="/products?ready=true" className="text-navy-800/85 hover:text-navy-950 hover:underline transition-colors font-medium">
                  Ready to Ship
                </Link>
              </li>
              <li>
                <Link to="/help" className="text-navy-800/85 hover:text-navy-950 hover:underline transition-colors font-medium">
                  Help Center & FAQs
                </Link>
              </li>
            </ul>
          </nav>

          {/* Column 3: Buyer Resources */}
          <nav aria-label="Buyer Resources">
            <h2 className="font-display text-xs font-bold uppercase tracking-widest text-navy-950">
              Buyer Resources
            </h2>
            <ul className="mt-3.5 space-y-2 text-xs">
              <li>
                <Link to="/rfq" className="text-navy-800/85 hover:text-navy-950 hover:underline transition-colors font-medium">
                  Post Requirement (RFQ)
                </Link>
              </li>
              <li>
                <Link to="/buyer/quotes/compare" className="text-navy-800/85 hover:text-navy-950 hover:underline transition-colors font-medium">
                  Smart Quote Comparison
                </Link>
              </li>
              <li>
                <Link to="/info/buyer-protection" className="text-navy-800/85 hover:text-navy-950 hover:underline transition-colors font-medium">
                  Buyer Protection Policy
                </Link>
              </li>
              <li>
                <Link to="/track" className="text-navy-800/85 hover:text-navy-950 hover:underline transition-colors font-medium">
                  Order Tracking
                </Link>
              </li>
              <li>
                <Link to="/buyer" className="text-navy-800/85 hover:text-navy-950 hover:underline transition-colors font-medium">
                  Buyer Dashboard
                </Link>
              </li>
              <li>
                <Link to="/wishlist" className="text-navy-800/85 hover:text-navy-950 hover:underline transition-colors font-medium">
                  Saved Products
                </Link>
              </li>
            </ul>
          </nav>

          {/* Column 4: Supplier Resources */}
          <nav aria-label="Supplier Resources">
            <h2 className="font-display text-xs font-bold uppercase tracking-widest text-navy-950">
              Supplier Resources
            </h2>
            <ul className="mt-3.5 space-y-2 text-xs">
              <li>
                <Link to="/register?role=supplier" className="text-navy-800/85 hover:text-navy-950 hover:underline transition-colors font-medium">
                  Become a Supplier
                </Link>
              </li>
              <li>
                <Link to="/supplier" className="text-navy-800/85 hover:text-navy-950 hover:underline transition-colors font-medium">
                  Supplier Dashboard
                </Link>
              </li>
              <li>
                <Link to="/supplier/products" className="text-navy-800/85 hover:text-navy-950 hover:underline transition-colors font-medium">
                  Manage Product Listings
                </Link>
              </li>
              <li>
                <Link to="/supplier/verification" className="text-navy-800/85 hover:text-navy-950 hover:underline transition-colors font-medium">
                  KYC Verification Review
                </Link>
              </li>
              <li>
                <Link to="/supplier/orders" className="text-navy-800/85 hover:text-navy-950 hover:underline transition-colors font-medium">
                  Wholesale Orders
                </Link>
              </li>
              <li>
                <Link to="/supplier/inquiries" className="text-navy-800/85 hover:text-navy-950 hover:underline transition-colors font-medium">
                  Buyer Inquiries & Quotes
                </Link>
              </li>
            </ul>
          </nav>

          {/* Column 5: Contact & Corporate */}
          <div aria-label="Contact and Support">
            <h2 className="font-display text-xs font-bold uppercase tracking-widest text-navy-950">
              Contact & Support
            </h2>
            <div className="mt-3.5 space-y-2.5 text-xs text-navy-800/85">
              <p className="flex items-start gap-2">
                <Mail className="size-3.5 text-brand-700 shrink-0 mt-0.5" />
                <a href="mailto:support@tradeexpress.com" className="hover:text-navy-950 hover:underline">
                  support@tradeexpress.com
                </a>
              </p>

              <p className="flex items-start gap-2">
                <Phone className="size-3.5 text-brand-700 shrink-0 mt-0.5" />
                <span>+91 96000 12345 (Mon–Sat)</span>
              </p>

              <p className="flex items-start gap-2">
                <MapPin className="size-3.5 text-brand-700 shrink-0 mt-0.5" />
                <span>Serving buyers and suppliers nationwide · India</span>
              </p>

              <div className="pt-2 border-t border-[#d8e7d2]">
                <Link
                  to="/admin/login"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-navy-700 hover:text-navy-950"
                >
                  <span>Admin Portal</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Legal & Reset Bar */}
      <div className="relative border-t border-[#d3e3cc] bg-[#e4eedf]/90 py-4 text-xs text-navy-800/80">
        <div className="ts-container flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="leading-relaxed">
            © {new Date().getFullYear()} {BRAND.name}. India's Premier Online B2B Marketplace. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <Link to="/info/terms" className="hover:text-navy-950 hover:underline">
              Terms of Use
            </Link>
            <Link to="/info/privacy" className="hover:text-navy-950 hover:underline">
              Privacy Policy
            </Link>
            <Link to="/info/buyer-protection" className="hover:text-navy-950 hover:underline">
              Buyer Protection
            </Link>
            <ResetDataButton variant="outline" className="!text-[11px] !py-1 !px-2.5" />
          </div>
        </div>
      </div>
    </footer>
  );
}
