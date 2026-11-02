import { Link } from 'react-router-dom';
import { BRAND } from '../../utils/constants';
import logoDark from '../../assets/logos/tradeexpress-logo.png';
import logoLight from '../../assets/logos/tradeexpress-logo-white.png';
import mark from '../../assets/logos/tradeexpress-mark.png';

/**
 * Official TradeExpress Brand Logo.
 * @param {boolean} light - Use white text variant for dark/navy backgrounds
 * @param {'xs' | 'sm' | 'md' | 'lg'} size - Scaled dimensions tailored for placement
 * @param {boolean} markOnly - Show only the dynamic TE arrow mark
 * @param {string} to - Destination link (defaults to '/')
 */
export default function Logo({
  light = false,
  className = '',
  size = 'md',
  markOnly = false,
  to = '/',
  showTagline, // backwards compatibility
  ...rest
}) {
  const imgSrc = markOnly ? mark : (light ? logoLight : logoDark);

  // Height and sizing tailored cleanly for each placement without overflow
  const sizeClasses = {
    xs: markOnly ? 'h-6 w-auto' : 'h-6.5 sm:h-7 w-auto',
    sm: markOnly ? 'h-7 sm:h-8 xl:h-8.5 w-auto' : 'h-7.5 sm:h-8 xl:h-8.5 w-auto',
    md: markOnly ? 'h-9 sm:h-10 w-auto' : 'h-9 sm:h-10 w-auto',
    lg: markOnly ? 'h-10 sm:h-11 xl:h-12 w-auto' : 'h-10 sm:h-11 xl:h-12 w-auto',
  }[size] || 'h-8.5 w-auto';

  const imageElement = (
    <img
      src={imgSrc}
      alt={BRAND.name}
      className={`object-contain max-w-none transition-transform duration-200 hover:opacity-95 ${sizeClasses}`}
      loading="eager"
      {...rest}
    />
  );

  if (!to) {
    return <div className={`inline-flex shrink-0 items-center ${className}`}>{imageElement}</div>;
  }

  return (
    <Link
      to={to}
      aria-label={`${BRAND.name} home`}
      className={`inline-flex shrink-0 items-center focus-visible:outline-2 focus-visible:outline-brand-500 rounded-lg ${className}`}
    >
      {imageElement}
    </Link>
  );
}
