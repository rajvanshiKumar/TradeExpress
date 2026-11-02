import { Link } from 'react-router-dom';

export default function StatCard({ icon: Icon, label, value, hint, to, tone = 'navy' }) {
  const tones = { navy: 'bg-navy-900 text-brand-400', brand: 'bg-brand-50 text-brand-700', success: 'bg-success-50 text-success', warning: 'bg-warning-50 text-warning' };
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.8125rem] font-semibold text-muted">{label}</p>
        {Icon ? <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="size-[1.125rem]" aria-hidden="true" /></span> : null}
      </div>
      <p className="mt-3 font-display text-[1.75rem] font-extrabold tracking-[-0.03em] text-navy-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </>
  );
  return to
    ? <Link to={to} className="ts-card ts-card-hover block p-5">{body}</Link>
    : <div className="ts-card p-5">{body}</div>;
}
