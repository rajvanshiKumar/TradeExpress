import { Link } from 'react-router-dom';
import { BRAND } from '../../utils/constants';
import mark from '../../assets/logos/tradesphere-mark.svg';

/** TradeSphere wordmark. `light` is for navy backgrounds. */
export default function Logo({ light = false, showTagline = true, className = '' }) {
  return (
    <Link to="/" aria-label={`${BRAND.name} home`} className={`inline-flex shrink-0 items-center gap-2.5 rounded-lg ${className}`}>
      <img src={mark} alt="" width="40" height="40" className={`size-9 rounded-[0.8rem] sm:size-10 ${light ? 'ring-1 ring-white/20' : ''}`} />
      <span className="leading-none">
        <span className={`block font-display text-xl font-extrabold tracking-[-0.03em] sm:text-[1.4rem] ${light ? 'text-white' : 'text-navy-900'}`}>
          Trade<span className={light ? 'text-brand-500' : 'text-brand-600'}>Sphere</span>
        </span>
        {showTagline ? <span className={`mt-1 hidden text-[0.5625rem] font-semibold uppercase tracking-[0.24em] xs:block ${light ? 'text-navy-200' : 'text-muted'}`}>{BRAND.tagline}</span> : null}
      </span>
    </Link>
  );
}
