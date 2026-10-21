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
    <footer className="relative mt-auto overflow-hidden border-t border-navy-900/[0.08] bg-white text-navy-800">
      <div className="pointer-events-none absolute -right-40 -top-40 size-[30rem] rounded-full bg-brand-500/5 blur-3xl" aria-hidden="true" />
      <div className="ts-container relative">
        <div className="flex flex-col gap-6 border-b border-navy-900/[0.07] py-10 md:flex-row md:items-center md:justify-between">
          <p className="max-w-xl font-display text-2xl font-extrabold leading-snug text-navy-950 sm:text-3xl">
            Sourcing made <span className="ts-serif italic text-brand-700">considered</span>, from first enquiry to bulk order.
          </p>
          <Link
            to="/rfq"
            className="group inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-navy-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-navy-800 active:bg-navy-950 hover:shadow hover:-translate-y-px md:self-auto"
          >
            Post a buying request{' '}
            <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-[1.3fr_3fr]">
          <div>
            <Logo showTagline={false} />
            <p className="mt-4 max-w-xs text-sm text-muted leading-relaxed">
              An international B2B marketplace connecting verified importers, exporters, manufacturers and wholesale buyers.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              <li>
                <Link to="/info/contact" className="inline-flex items-center gap-2 text-navy-800 hover:text-brand-700 font-medium transition-colors">
                  <Mail className="size-4 text-brand-600" aria-hidden="true" />
                  Contact TradeSphere
                </Link>
              </li>
              <li className="flex items-center gap-2 text-muted">
                <MapPin className="size-4 text-brand-600" aria-hidden="true" />
                Serving buyers and suppliers worldwide · Prices in INR
              </li>
            </ul>
            <ul className="mt-6 flex gap-2" aria-label="Share TradeSphere">
              {shareLinks().map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    title={item.label}
                    className="inline-flex size-9 sm:size-10 items-center justify-center rounded-full border border-navy-900/10 bg-surface/40 text-navy-700 shadow-2xs transition-all hover:border-navy-900 hover:bg-navy-900 hover:text-white hover:-translate-y-0.5"
                  >
                    <item.icon className="size-4" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {footerColumns.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-navy-950 font-display">
                  {column.title}
                </h2>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link to={link.to} className="text-sm text-navy-700/80 transition-colors hover:text-navy-950 hover:font-medium">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
      </div>

      <div className="relative border-t border-navy-900/[0.07] bg-surface/40">
        <div className="ts-container flex flex-col gap-4 py-6 text-xs md:flex-row md:items-center md:justify-between">
          <p className="max-w-3xl leading-relaxed text-muted">
            © {new Date().getFullYear()} {BRAND.name}. Company profiles are self-described unless marked as reviewed; please carry out your own checks before trading. Online payment processing is not yet available.
          </p>
          <ResetDataButton variant="outline" />
        </div>
      </div>
    </footer>
  );
}
