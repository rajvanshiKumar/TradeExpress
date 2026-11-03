import { Link } from 'react-router-dom';
import { ArrowRight, FileText, LifeBuoy, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import useDocumentTitle from '../hooks/useDocumentTitle';

// Lists the policy documents that exist today. New policies (for example Payment & Refund) are added
// here only once their text has been written and reviewed; this page never states policy itself.
const POLICIES = [
  { title: 'Terms & Conditions', description: 'The terms that govern access to and trading on TradeExpress.', to: '/terms', icon: FileText },
  { title: 'Privacy', description: 'What happens to the information you enter on TradeExpress.', to: '/info/privacy', icon: ShieldCheck },
  { title: 'Buyer protection guide', description: 'General guidance for trading safely on a B2B marketplace.', to: '/info/buyer-protection', icon: ShieldCheck },
];

export default function Policies() {
  useDocumentTitle('Policies & Rules | TradeExpress');

  return (
    <div className="bg-surface pb-16">
      <PageHeader
        breadcrumbs={[{ label: 'Help Center', to: '/help' }, { label: 'Policies & Rules' }]}
        title="Policies & Rules"
        description="The documents that set out how TradeExpress works for buyers and suppliers."
      />
      <div className="ts-container max-w-4xl py-8">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {POLICIES.map(({ title, description, to, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="group flex h-full items-start gap-4 rounded-2xl border border-line bg-white p-5 shadow-card transition-[border-color,box-shadow] hover:border-success/40 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success"
              >
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-bold text-navy-900">{title}</span>
                  <span className="mt-1 block text-sm text-muted">{description}</span>
                </span>
                <ArrowRight className="mt-1 size-4 shrink-0 text-muted group-hover:text-success" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-8 flex items-center gap-2 text-sm text-muted">
          <LifeBuoy className="size-4 text-success" aria-hidden="true" />
          Questions about a policy?{' '}
          <Link to="/help#support" className="font-semibold text-success hover:underline">Contact support</Link>
        </p>
      </div>
    </div>
  );
}
