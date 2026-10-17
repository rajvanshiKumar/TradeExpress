import { Link } from 'react-router-dom';
import { ArrowRight, Globe, X } from 'lucide-react';
import useLocalStorage from '../../hooks/useLocalStorage';

/** Slim business-focused bar above the header. */
export default function AnnouncementBar() {
  const [dismissed, setDismissed] = useLocalStorage('announcement-dismissed', false);
  if (dismissed) return null;
  return (
    <div id="announcement-bar" className="ts-charcoal text-white">
      <div className="ts-container flex items-center gap-3 py-2 text-[0.8125rem]">
        <Globe className="hidden size-4 shrink-0 text-brand-500 sm:block" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate">
          <span className="font-semibold tracking-wide">International B2B Marketplace</span>
          <span className="mx-2 text-white/30" aria-hidden="true">|</span>
          <span className="text-white/70">Wholesale sourcing from manufacturers and exporters · Prices in INR</span>
        </p>
        <Link to="/rfq" className="hidden shrink-0 items-center gap-1.5 font-semibold text-brand-500 hover:text-brand-400 md:inline-flex">
          Post a buying request <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
        <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss announcement" className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
