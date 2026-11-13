import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Info,
  Layers,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

const ABOUT_ITEMS = [
  {
    title: 'About TradeExpress',
    to: '/info/about',
    icon: Building2,
    badge: 'Company',
    description: 'Our mission, marketplace story and verified B2B network.',
  },
  {
    title: 'How It Works',
    to: '/info/about#how-it-works',
    icon: Layers,
    badge: 'Guide',
    description: 'Discover products, check MOQ tiers and trade securely.',
  },
  {
    title: 'Buyer Protection',
    to: '/info/buyer-protection',
    icon: ShieldCheck,
    badge: 'Safety',
    description: 'Escrow settlements, quality inspection and dispute resolution.',
  },
  {
    title: 'Help Center & FAQs',
    to: '/help',
    icon: HelpCircle,
    badge: 'Support',
    description: 'Wholesale guides, policies, and support ticket resolution.',
  },
  {
    title: 'Contact Support',
    to: '/info/contact',
    icon: Mail,
    badge: 'Desk',
    description: 'Direct inquiry form for customer care and partnerships.',
  },
];

export default function AboutMenu({ active = false }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { t } = useTranslation();
  const rootRef = useRef(null);
  const timerRef = useRef(null);

  // Close when route changes
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  // Handle escape key and click outside
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  const handleMouseEnter = () => {
    window.clearTimeout(timerRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timerRef.current = window.setTimeout(() => setOpen(false), 180);
  };

  return (
    <div
      ref={rootRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative inline-flex items-center"
    >
      <Link
        to="/info/about"
        onClick={() => setOpen(false)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-current={active ? 'page' : undefined}
        className={`relative inline-flex h-9 xl:h-9.5 items-center gap-1.5 whitespace-nowrap rounded-full px-3 xl:px-3.5 text-xs xl:text-[13.5px] font-semibold transition-all duration-150 ${
          active || open
            ? 'bg-navy-900/[0.08] text-navy-950 font-bold ring-1 ring-navy-900/10'
            : 'text-navy-700 hover:bg-navy-900/[0.04] hover:text-navy-950'
        }`}
      >
        <Info className="size-3.5 shrink-0 opacity-75" aria-hidden="true" />
        <span>{t('nav.about', {}, 'About Us')}</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
          aria-label="Toggle About section menu"
          className="p-0.5 rounded-full hover:bg-navy-900/10 transition-colors"
        >
          <ChevronDown
            className={`size-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </Link>

      {open && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="ts-dropdown-anim-center absolute left-1/2 -translate-x-1/2 top-full mt-2.5 z-50 w-[23rem] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/98 backdrop-blur-2xl p-2 text-slate-900 shadow-[0_20px_48px_-10px_rgba(11,39,22,0.18),0_0_0_1px_rgba(0,0,0,0.06)]"
        >
          {/* Subtle Emerald Top Accent */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-transparent via-emerald-600/70 to-transparent"
            aria-hidden="true"
          />

          {/* Header */}
          <div className="px-3.5 pt-3 pb-2.5 border-b border-slate-100/90 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                <Sparkles className="size-3.5 text-emerald-700" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-navy-950 tracking-tight">About TradeExpress</h4>
                <p className="text-[11px] text-slate-500">B2B Wholesale Trade Platform</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-100/80 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
              Verified
            </span>
          </div>

          {/* Section Links */}
          <ul className="py-1 space-y-0.5">
            {ABOUT_ITEMS.map((item) => {
              const Icon = item.icon;
              const isCurrent = location.pathname === item.to || (item.to.includes('#') && location.pathname + location.hash === item.to);
              return (
                <li key={item.title}>
                  <Link
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={`group flex items-start gap-3 rounded-xl px-3 py-2 transition-all ${
                      isCurrent
                        ? 'bg-emerald-50/90 text-emerald-950 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-navy-950'
                    }`}
                  >
                    <div className="mt-0.5 size-7 rounded-lg bg-slate-100/80 group-hover:bg-emerald-100/70 text-slate-700 group-hover:text-emerald-800 flex items-center justify-center shrink-0 transition-colors">
                      <Icon className="size-3.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-navy-950 group-hover:text-emerald-950">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium group-hover:text-emerald-700 transition-colors">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 leading-snug">
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight className="size-3.5 text-slate-300 group-hover:text-emerald-600 self-center shrink-0 transition-colors" />
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Footer Callout */}
          <div className="mt-1 pt-2 border-t border-slate-100 px-3 py-1.5 bg-slate-50/70 rounded-xl flex items-center justify-between text-[11px]">
            <span className="text-slate-600 font-medium">Safe B2B Trading & Escrow</span>
            <Link
              to="/info/about"
              onClick={() => setOpen(false)}
              className="font-bold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-0.5"
            >
              <span>Explore</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

