import { Link } from 'react-router-dom';
import { FileText, FileWarning, Flag, Headset, LifeBuoy, Scale } from 'lucide-react';
import Dropdown from '../common/Dropdown';
import useAuth from '../../hooks/useAuth';

const ITEMS = [
  { label: 'Help Center', to: '/help', icon: LifeBuoy },
  { label: 'Policies & Rules', to: '/policies', icon: FileText },
  { label: 'File a trade dispute', to: '/buyer/disputes', icon: Scale, buyersOnly: true },
  // Reporting forms arrive in a later phase; until then these open the Help Center support section
  { label: 'Report IP infringement', to: '/help#support', icon: FileWarning },
  { label: 'Report a violation', to: '/help#support', icon: Flag },
];

/** Header support menu (headset icon): help, policies, disputes and reporting. */
export default function SupportMenu({ className = '' }) {
  const { user } = useAuth();
  const items = ITEMS.filter((item) => !item.buyersOnly || user?.role !== 'supplier');

  return (
    <Dropdown
      className={className}
      panelClassName="w-64 p-1.5"
      trigger={({ open, props }) => (
        <button
          type="button"
          {...props}
          aria-label="Help and support"
          title="Help and support"
          className={`relative inline-flex size-7.5 sm:size-8 xl:size-8.5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-navy-900/5 hover:text-navy-950 ${
            open ? 'bg-navy-900/[0.08] text-navy-950' : 'text-navy-800'
          }`}
        >
          <Headset className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
    >
      {({ close }) => (
        <ul className="py-1">
          {items.map(({ label, to, icon: Icon }) => (
            <li key={label}>
              <Link
                to={to}
                role="menuitem"
                onClick={close}
                className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-emerald-50/70 hover:text-emerald-950"
              >
                <Icon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Dropdown>
  );
}
