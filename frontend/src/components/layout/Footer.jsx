import { Link, useLocation } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronRight,
  Facebook,
  Factory,
  Headphones,
  Landmark,
  Link2,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingCart,
  Twitter,
  Youtube,
  Globe,
} from 'lucide-react';
import Logo from '../common/Logo';
import ResetDataButton from '../common/ResetDataButton';
import { BRAND } from '../../utils/constants';
import useAuth from '../../hooks/useAuth';
import { useTranslation } from '../../i18n/LanguageContext';

const SOCIAL_LINKS = [
  { label: 'LinkedIn', icon: Linkedin, href: 'https://www.linkedin.com' },
  { label: 'Twitter', icon: Twitter, href: 'https://twitter.com' },
  { label: 'Facebook', icon: Facebook, href: 'https://facebook.com' },
  { label: 'YouTube', icon: Youtube, href: 'https://youtube.com' },
  { label: 'WhatsApp', icon: MessageCircle, href: 'https://wa.me' },
];

const QUICK_LINKS = [
  { label: 'Explore Products', to: '/products' },
  { label: 'All Categories', to: '/categories' },
  { label: 'Verified Suppliers', to: '/suppliers' },
  { label: 'Indian Exporters', to: '/exporters' },
  { label: 'Ready to Ship', to: '/products?ready=true' },
  { label: 'Help Center & FAQs', to: '/help' },
  { label: 'Terms & Conditions', to: '/terms' },
];

const BUYER_RESOURCES = [
  { label: 'Post Requirement (RFQ)', to: '/rfq' },
  { label: 'Buyer Protection Policy', to: '/info/buyer-protection' },
  { label: 'Order Tracking', to: '/track' },
  { label: 'Buyer Dashboard', to: '/buyer' },
  { label: 'Saved Products', to: '/wishlist' },
];

const SUPPLIER_RESOURCES = [
  { label: 'Become a Supplier', to: '/register?role=supplier' },
  { label: 'Supplier Dashboard', to: '/supplier' },
  { label: 'Manage Product Listings', to: '/supplier/products' },
  { label: 'KYC Verification Review', to: '/supplier/verification' },
  { label: 'Wholesale Orders', to: '/supplier/orders' },
  { label: 'Buyer Inquiries & Quotes', to: '/supplier/inquiries' },
];


/**
 * Faint maritime shipping / global trade watermark on bottom right
 */
function MaritimeWatermark() {
  return (
    <div className="pointer-events-none absolute bottom-12 right-0 z-0 select-none overflow-hidden opacity-[0.22]">
      <svg
        viewBox="0 0 620 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-[140px] w-auto max-w-none text-[#2b7244]"
      >
        {/* World Map Dotted / Grid Silhouette */}
        <g stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" opacity="0.6">
          <ellipse cx="480" cy="55" rx="100" ry="40" />
          <path d="M400 55 H 560" />
          <path d="M480 15 V 95" />
          <circle cx="450" cy="45" r="3" fill="currentColor" />
          <circle cx="510" cy="50" r="3" fill="currentColor" />
          <circle cx="475" cy="70" r="2.5" fill="currentColor" />
        </g>

        {/* Harbor Cranes */}
        <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M110 140 L 130 50 L 175 40" />
          <path d="M130 50 L 210 30" />
          <path d="M120 140 L 130 50" />
          <path d="M140 140 L 130 50" />
          <path d="M185 36 V 70" strokeWidth="1" />
          <rect x="180" y="70" width="10" height="7" fill="currentColor" />

          <path d="M70 140 L 85 70 L 120 60" />
          <path d="M85 70 L 150 50" />
        </g>

        {/* Cargo Container Ship */}
        <g fill="currentColor">
          {/* Hull */}
          <path d="M130 145 L 160 168 H 360 L 390 145 Z" />
          {/* Bridge / Tower */}
          <rect x="330" y="125" width="22" height="20" rx="1" />
          <rect x="334" y="115" width="14" height="10" rx="1" />
          <line x1="341" y1="115" x2="341" y2="105" stroke="currentColor" strokeWidth="1.5" />

          {/* Stacked Containers */}
          <rect x="175" y="132" width="24" height="13" rx="0.5" />
          <rect x="202" y="132" width="24" height="13" rx="0.5" />
          <rect x="229" y="132" width="24" height="13" rx="0.5" />
          <rect x="256" y="132" width="24" height="13" rx="0.5" />
          <rect x="283" y="132" width="24" height="13" rx="0.5" />

          <rect x="188" y="117" width="24" height="13" rx="0.5" />
          <rect x="215" y="117" width="24" height="13" rx="0.5" />
          <rect x="242" y="117" width="24" height="13" rx="0.5" />
          <rect x="269" y="117" width="24" height="13" rx="0.5" />

          <rect x="202" y="103" width="24" height="12" rx="0.5" />
          <rect x="229" y="103" width="24" height="12" rx="0.5" />
          <rect x="256" y="103" width="24" height="12" rx="0.5" />
        </g>

        {/* Waves */}
        <path
          d="M80 168 C 140 162, 180 172, 240 168 C 300 164, 340 173, 400 168 C 450 164, 480 170, 520 168"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
    </div>
  );
}

export default function Footer() {
  const { user } = useAuth();
  const location = useLocation();
  const { t, currentLanguage, currentCountry } = useTranslation();
  const isSupplier = user?.role === 'supplier';
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/forgot-password';
  const buyerResources = isAuthPage
    ? BUYER_RESOURCES.filter((item) => !item.label.toLowerCase().includes('quote') && !item.to.includes('compare'))
    : BUYER_RESOURCES;
  const supplierResources = (isAuthPage
    ? SUPPLIER_RESOURCES.filter((item) => !item.to.includes('inquiries'))
    : SUPPLIER_RESOURCES
  ).filter((item) => {
    // When signed in as a supplier, do not show Become / Join as a Supplier in footer
    if (isSupplier && (item.to.includes('role=supplier') || item.to.includes('/supplier/register') || item.label.toLowerCase().includes('become a supplier'))) {
      return false;
    }
    return true;
  });
  const socialLinks = isAuthPage
    ? SOCIAL_LINKS.filter((item) => item.label !== 'WhatsApp')
    : SOCIAL_LINKS;

  return (
    <footer className="relative mt-auto overflow-hidden border-t border-[#c5d5c3] bg-gradient-to-b from-[#e6ece4] via-[#dde6da] to-[#d4e0d2] text-slate-800">
      {/* Background Maritime / Trade Watermark */}
      <MaritimeWatermark />

      <div className="ts-container relative z-10 pt-12 pb-8">
        {/* Main 5-Column Grid Layout with Light Grey Vertical Divider Lines */}
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 lg:gap-7">
          {/* Column 1: Brand & Credentials (Takes 4 cols on large screens) */}
          <div className="sm:col-span-2 md:col-span-3 lg:col-span-4 pr-0 lg:pr-7 lg:border-r lg:border-slate-300/80">
            <Logo size="lg" to="/" />

            <h3 className="mt-4 font-display text-[15px] font-bold text-slate-900 tracking-tight">
              India's Leading Online B2B Marketplace
            </h3>

            <p className="mt-2 text-xs leading-relaxed text-slate-700 max-w-sm">
              TradeExpress connects verified buyers, wholesale importers, manufacturers, and
              exporters across India with secure escrow protection.
            </p>

            {/* Trust Badges */}
            <div className="mt-4.5 space-y-2.5">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-emerald-950">
                <span className="flex size-5.5 items-center justify-center rounded-full bg-emerald-700 text-white shrink-0 shadow-2xs">
                  <CheckCircle2 className="size-3.5" />
                </span>
                <span>Verified GST & KYC Businesses</span>
              </div>

              <div className="flex items-center gap-2.5 text-xs font-semibold text-emerald-950">
                <span className="flex size-5.5 items-center justify-center rounded-full bg-emerald-800 text-white shrink-0 shadow-2xs">
                  <Landmark className="size-3" />
                </span>
                <span>100% Escrow Payment Protection</span>
              </div>
            </div>

            {/* Social Icons */}
            <div className="mt-5 flex items-center gap-2.5" aria-label="Social Links">
              {socialLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.label}
                  title={item.label}
                  className="flex size-8.5 items-center justify-center rounded-full border border-emerald-300/80 bg-white/95 text-emerald-900 shadow-2xs transition-all duration-200 hover:border-emerald-700 hover:bg-emerald-700 hover:text-white hover:scale-105"
                >
                  <item.icon className="size-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Column 2: Quick Links (Takes 2 cols) */}
          <nav aria-label="Quick Links" className="lg:col-span-2 lg:pr-5 lg:border-r lg:border-slate-300/80">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-emerald-200/80 text-emerald-950 shrink-0 shadow-2xs">
                <Link2 className="size-4" />
              </span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  QUICK LINKS
                </h4>
                <div className="mt-1 h-0.5 w-6 rounded-full bg-emerald-700" />
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-xs">
              {QUICK_LINKS.map((item) => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    className="group flex items-center justify-between text-slate-700 hover:text-emerald-950 transition-colors py-0.5 font-medium"
                  >
                    <span>{item.label}</span>
                    <ChevronRight className="size-3 text-slate-500 group-hover:text-emerald-900 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Column 3: Buyer Resources (Takes 2 cols) */}
          <nav aria-label="Buyer Resources" className="lg:col-span-2 lg:pr-5 lg:border-r lg:border-slate-300/80">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-emerald-200/80 text-emerald-950 shrink-0 shadow-2xs">
                <ShoppingCart className="size-4" />
              </span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  BUYER RESOURCES
                </h4>
                <div className="mt-1 h-0.5 w-6 rounded-full bg-emerald-700" />
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-xs">
              {buyerResources.map((item) => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    className="group flex items-center justify-between text-slate-700 hover:text-emerald-950 transition-colors py-0.5 font-medium"
                  >
                    <span>{item.label}</span>
                    <ChevronRight className="size-3 text-slate-500 group-hover:text-emerald-900 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Column 4: Supplier Resources (Takes 2 cols) */}
          <nav aria-label="Supplier Resources" className="lg:col-span-2 lg:pr-5 lg:border-r lg:border-slate-300/80">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-emerald-200/80 text-emerald-950 shrink-0 shadow-2xs">
                <Factory className="size-4" />
              </span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  SUPPLIER RESOURCES
                </h4>
                <div className="mt-1 h-0.5 w-6 rounded-full bg-emerald-700" />
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-xs">
              {supplierResources.map((item) => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    className="group flex items-center justify-between text-slate-700 hover:text-emerald-950 transition-colors py-0.5 font-medium"
                  >
                    <span>{item.label}</span>
                    <ChevronRight className="size-3 text-slate-500 group-hover:text-emerald-900 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Column 5: Contact & Support (Takes 2 cols) */}
          <div aria-label="Contact and Support" className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-emerald-200/80 text-emerald-950 shrink-0 shadow-2xs">
                <Headphones className="size-4" />
              </span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  CONTACT & SUPPORT
                </h4>
                <div className="mt-1 h-0.5 w-6 rounded-full bg-emerald-700" />
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-700">
              <div className="flex items-start gap-2.5">
                <Mail className="size-4 text-emerald-800 shrink-0 mt-0.5" />
                <a
                  href="mailto:support@tradeexpress.com"
                  className="hover:text-emerald-950 hover:underline break-all font-medium"
                >
                  support@tradeexpress.com
                </a>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="size-4 text-emerald-800 shrink-0 mt-0.5" />
                <span className="font-medium">+91 96000 12345 (Mon–Sat)</span>
              </div>

              <div className="flex items-start gap-2.5">
                <MapPin className="size-4 text-emerald-800 shrink-0 mt-0.5" />
                <span className="leading-snug">
                  Serving buyers and suppliers nationwide – India
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Country/Region and Language Bar (Amazon style) */}
      <div className="relative z-10 border-t border-[#b7cbb5] bg-[#c3d3c1]/85 py-3.5 text-xs text-slate-800">
        <div className="ts-container flex flex-wrap items-center justify-center gap-3 sm:gap-6">
          <Logo size="xs" />
          <Link
            to="/country-region"
            title="Change Language & Market"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-400/80 bg-white/95 px-3 py-1.5 font-bold text-slate-800 shadow-2xs hover:bg-white hover:border-emerald-700 hover:text-emerald-950 transition-all"
          >
            <Globe className="size-3.5 text-emerald-800" aria-hidden="true" />
            <span>{currentLanguage.nativeName} ({currentLanguage.short})</span>
          </Link>
          <Link
            to="/country-region"
            title="Change Country / Region"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-400/80 bg-white/95 px-3 py-1.5 font-bold text-slate-800 shadow-2xs hover:bg-white hover:border-emerald-700 hover:text-emerald-950 transition-all"
          >
            <span className="text-sm select-none" aria-hidden="true">{currentCountry.flag}</span>
            <span>{currentCountry.name}</span>
          </Link>
        </div>
      </div>

      {/* Bottom Legal & Sample Data Reset Bar */}
      <div className="relative z-10 border-t border-[#c5d5c3] bg-[#ccd9cb]/85 py-4 text-xs text-slate-700">
        <div className="ts-container flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="leading-relaxed font-medium">
            © {new Date().getFullYear()} {BRAND.name}. {t('footer.tagline', {}, "India's Premier Online B2B Marketplace.")} {t('footer.allRightsReserved', {}, 'All rights reserved.')}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
            <Link to="/terms" className="hover:text-emerald-950 hover:underline font-semibold text-slate-800">
              Terms & Conditions
            </Link>
            <span className="text-slate-400">|</span>
            <Link to="/info/privacy" className="hover:text-emerald-950 hover:underline">
              {t('footer.privacy', {}, 'Privacy Policy')}
            </Link>
            <span className="text-slate-400">|</span>
            <Link to="/info/buyer-protection" className="hover:text-emerald-950 hover:underline">
              {t('footer.buyerProtection', {}, 'Buyer Protection')}
            </Link>
            <span className="text-slate-400">|</span>
            <ResetDataButton
              variant="outline"
              className="!rounded-full !border-slate-400/80 !bg-white !px-3 !py-1 !text-[11px] !font-medium !text-slate-800 shadow-2xs hover:!bg-slate-50"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
