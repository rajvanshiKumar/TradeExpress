import { Link } from 'react-router-dom';
import { ArrowUpRight, Facebook, Linkedin, Mail, MapPin, MessageCircle, Twitter } from 'lucide-react';
import Logo from '../common/Logo';
import ResetDataButton from '../common/ResetDataButton';
import { footerColumns } from '../../data/navigation';
import { BRAND } from '../../utils/constants';

// TradeSphere does not publish social profiles yet, so these open each network's share
// dialog for the current site rather than linking to an account that does not exist.
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

export default function Footer() {
  return (
    <footer className="ts-charcoal relative mt-auto overflow-hidden text-white/70">
      <div className="pointer-events-none absolute -right-40 -top-40 size-[30rem] rounded-full bg-brand-500/10 blur-3xl" aria-hidden="true" />
      <div className="ts-container relative">
        <div className="flex flex-col gap-6 border-b border-white/10 py-10 md:flex-row md:items-center md:justify-between">
          <p className="max-w-xl font-display text-2xl font-bold leading-snug text-white sm:text-3xl">
            Sourcing made <span className="ts-serif text-brand-500">considered</span>, from first enquiry to bulk order.
          </p>
          <Link to="/rfq" className="group inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-brand-500/50 px-6 py-3 text-sm font-semibold text-brand-500 transition-colors hover:bg-brand-500 hover:text-navy-900 md:self-auto">
            Post a buying request <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-[1.3fr_3fr]">
          <div>
            <Logo light />
            <p className="mt-5 max-w-xs text-sm leading-relaxed">An international B2B marketplace connecting importers, exporters, manufacturers and wholesale buyers.</p>
            <ul className="mt-5 space-y-2.5 text-sm">
              <li><Link to="/info/contact" className="inline-flex items-center gap-2 text-white hover:text-brand-500"><Mail className="size-4 text-brand-500" aria-hidden="true" />Contact TradeSphere</Link></li>
              <li className="flex items-center gap-2"><MapPin className="size-4 text-brand-500" aria-hidden="true" />Serving buyers and suppliers worldwide · Prices in INR</li>
            </ul>
            <ul className="mt-6 flex gap-2" aria-label="Share TradeSphere">
              {shareLinks().map((item) => (
                <li key={item.label}>
                  <a href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.label} title={item.label} className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:border-brand-500 hover:bg-brand-500 hover:text-navy-900">
                    <item.icon className="size-4" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {footerColumns.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] !text-brand-500">{column.title}</h2>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.label}><Link to={link.to} className="text-sm transition-colors hover:text-white">{link.label}</Link></li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="ts-container flex flex-col gap-4 py-6 text-xs md:flex-row md:items-center md:justify-between">
          <p className="max-w-3xl leading-relaxed text-white/50">
            © {new Date().getFullYear()} {BRAND.name}. Company profiles are self-described unless marked as reviewed; please carry out your own checks before trading. Online payment processing is not yet available.
          </p>
          <ResetDataButton variant="glass" />
        </div>
      </div>
    </footer>
  );
}
