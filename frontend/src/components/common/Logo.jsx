import { Link } from 'react-router-dom';
import { BRAND } from '../../utils/constants';
import mark from '../../assets/logos/tradesphere-mark.svg';

/** TradeSphere wordmark. `light` is for navy backgrounds. `size="sm"` is compact for header. */
export default function Logo({ light = false, showTagline = true, className = '', size = 'md' }) {
  const isSm = size === 'sm';
  return (
    <Link to="/" aria-label={`${BRAND.name} home`} className={`inline-flex shrink-0 items-center ${isSm ? 'gap-1.5 sm:gap-2' : 'gap-2.5'} rounded-lg ${className}`}>
      <img
        src={mark}
        alt=""
        width={isSm ? "28" : "40"}
        height={isSm ? "28" : "40"}
        className={`${isSm ? 'size-6.5 sm:size-7 xl:size-7.5 rounded-[0.55rem]' : 'size-9 sm:size-10 rounded-[0.8rem]'} ${light ? 'ring-1 ring-white/20' : ''}`}
      />
      <span className="leading-none">
        <span className={`block font-display font-extrabold tracking-[-0.03em] ${isSm ? 'text-[0.95rem] sm:text-base xl:text-[1.125rem]' : 'text-xl sm:text-[1.4rem]'} ${light ? 'text-white' : 'text-navy-900'}`}>
          Trade<span className={light ? 'text-brand-500' : 'text-brand-600'}>Sphere</span>
        </span>
        {showTagline && !isSm ? (
          <span className={`mt-0.5 hidden text-[0.5625rem] font-semibold uppercase tracking-[0.24em] xs:block ${light ? 'text-navy-200' : 'text-muted'}`}>
            {BRAND.tagline}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
