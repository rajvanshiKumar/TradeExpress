import { STATUS_TONES } from '../../utils/constants';

const tones = {
  neutral: 'bg-slate-100 text-slate-700',
  navy: 'bg-navy-50 text-navy-800',
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-success-50 text-green-800',
  warning: 'bg-warning-50 text-warning',
  danger: 'bg-danger-50 text-red-700',
  solid: 'bg-brand-500 text-white',
  dark: 'bg-navy-900 text-white',
  glass: 'bg-white/15 text-white',
};

export default function Badge({ tone = 'neutral', icon: Icon, className = '', children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] ${tones[tone] ?? tones.neutral} ${className}`}>
      {Icon ? <Icon className="size-3" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** Badge coloured by an order, quote or account status. */
export function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONES[status] ?? 'neutral'}>{status}</Badge>;
}

/** Marks sample content. */
export function SampleBadge({ children = 'Sample', className = '', tone = 'navy' }) {
  return <Badge tone={tone} className={className}>{children}</Badge>;
}
