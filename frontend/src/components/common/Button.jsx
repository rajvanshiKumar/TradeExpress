import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';

const base = 'inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-[-0.005em] whitespace-nowrap transition-all duration-200 ease-out disabled:opacity-55 disabled:pointer-events-none disabled:shadow-none select-none';

const variants = {
  primary: 'bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950 shadow-[var(--shadow-gold)] hover:-translate-y-px',
  navy: 'bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950 shadow-sm hover:-translate-y-px',
  outline: 'bg-white text-navy-900 border border-navy-900/15 hover:border-navy-900 hover:bg-white',
  ghost: 'text-navy-900 hover:bg-navy-900/5',
  subtle: 'bg-navy-50 text-navy-900 hover:bg-navy-100',
  danger: 'bg-danger text-white hover:bg-red-800 shadow-sm',
  dangerOutline: 'bg-white text-danger border border-red-200 hover:bg-danger-50',
  white: 'bg-white text-navy-900 hover:bg-ivory shadow-sm hover:-translate-y-px',
  glass: 'bg-white/[0.06] text-white border border-white/25 backdrop-blur hover:bg-white/[0.12] hover:border-white/50',
  gold: 'bg-transparent text-brand-500 border border-brand-500/60 hover:bg-brand-500 hover:text-navy-900',
};

const sizes = {
  sm: 'min-h-10 px-4 text-[0.8125rem]',
  md: 'min-h-11 px-5 text-sm',
  lg: 'min-h-[3.25rem] px-7 text-[0.9375rem]',
};

/**
 * The one button used across TradeSphere. Pass `to` for an internal link or `href`
 * for an external one; otherwise it renders a <button>.
 */
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', to, href, icon: Icon, iconRight: IconRight, loading = false, full = false, className = '', children, type = 'button', disabled, ...rest },
  ref,
) {
  const classes = `${base} ${variants[variant] ?? variants.primary} ${sizes[size] ?? sizes.md} ${full ? 'w-full' : ''} ${className}`;
  const content = (
    <>
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
      {children}
      {IconRight && !loading ? <IconRight className="size-4 shrink-0" aria-hidden="true" /> : null}
    </>
  );

  if (to) return <Link ref={ref} to={to} className={classes} {...rest}>{content}</Link>;
  if (href) return <a ref={ref} href={href} className={classes} {...rest}>{content}</a>;
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
});

export default Button;

/** Square icon-only button. `label` is required for screen readers. */
export const IconButton = forwardRef(function IconButton({ icon: Icon, label, className = '', size = 'md', tone = 'default', ...rest }, ref) {
  const dimension = size === 'sm' ? 'size-9' : 'size-11';
  const tones = {
    default: 'text-navy-900 hover:bg-navy-900/5',
    light: 'text-white hover:bg-white/10',
    danger: 'text-danger hover:bg-danger-50',
    muted: 'text-muted hover:bg-navy-50 hover:text-navy-900',
  };
  return (
    <button ref={ref} type="button" aria-label={label} title={label} className={`inline-flex ${dimension} shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${tones[tone]} ${className}`} {...rest}>
      <Icon className={size === 'sm' ? 'size-4 sm:size-[1.05rem]' : 'size-5'} aria-hidden="true" />
    </button>
  );
});
