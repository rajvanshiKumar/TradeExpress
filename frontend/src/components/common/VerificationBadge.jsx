import { BadgeCheck, Clock3, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { getVerification } from '../../utils/verification';

const ICONS = { reviewed: BadgeCheck, 'under-review': Clock3, rejected: ShieldAlert };
const TONES = {
  reviewed: 'bg-success-50 text-success ring-success/20',
  'under-review': 'bg-warning-50 text-warning ring-warning/20',
  rejected: 'bg-danger-50 text-danger ring-danger/20',
};

/** Honest supplier verification indicator. Only admin-reviewed companies show the emerald state. */
export default function VerificationBadge({ company, size = 'sm', className = '', iconOnly = false }) {
  const info = getVerification(company);
  const Icon = ICONS[info.status] ?? ShieldQuestion;
  const tone = TONES[info.status] ?? 'bg-navy-50 text-navy-700 ring-navy-900/10';
  if (iconOnly) {
    return <Icon className={`size-4 shrink-0 ${info.status === 'reviewed' ? 'text-success' : 'text-navy-600'} ${className}`} aria-label={info.label} role="img" />;
  }
  return (
    <span title={info.description} className={`inline-flex items-center gap-1 rounded-full font-semibold ring-1 ${size === 'sm' ? 'px-2 py-0.5 text-[0.6875rem]' : 'px-3 py-1 text-xs'} ${tone} ${className}`}>
      <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} aria-hidden="true" />{info.label}
    </span>
  );
}
