import { Globe } from 'lucide-react';
import Dropdown from '../common/Dropdown';
import Select from '../common/Select';
import useAuth from '../../hooks/useAuth';
import { COUNTRIES, CURRENCY, LANGUAGES } from '../../utils/constants';

/** Region and language selects, shared by the header dropdown and the mobile menu. */
export function PreferenceFields({ idPrefix = 'pref' }) {
  const { preferences, setPreferences } = useAuth();
  return (
    <div className="space-y-3">
      <Select id={`${idPrefix}-country`} label="Ship to" value={preferences.country} onChange={(event) => setPreferences({ country: event.target.value })} options={COUNTRIES} />
      <Select id={`${idPrefix}-language`} label="Language" value={preferences.language} onChange={(event) => setPreferences({ language: event.target.value })} options={LANGUAGES.map((item) => ({ value: item.code, label: item.label }))} />
      <div>
        <p className="ts-label">Currency</p>
        <p className="rounded-[0.625rem] border bg-surface px-3.5 py-2.5 text-sm font-semibold text-navy-900">{CURRENCY.symbol} Indian Rupee ({CURRENCY.code})</p>
        <p className="mt-1.5 text-[0.8125rem] text-muted">All prices are listed in Indian Rupees.</p>
      </div>
    </div>
  );
}

export default function PreferencesMenu() {
  const { preferences } = useAuth();
  return (
    <Dropdown
      panelClassName="w-72 p-4"
      trigger={({ props }) => (
        <button type="button" {...props} aria-label={`Region and language: ${preferences.country}, English, ${CURRENCY.code}`} className="inline-flex h-11 items-center gap-1.5 rounded-[0.625rem] px-2.5 text-left hover:bg-navy-50">
          <Globe className="size-5 text-navy-900" aria-hidden="true" />
          <span className="leading-tight">
            <span className="block max-w-24 truncate text-[0.6875rem] text-muted">{preferences.country}</span>
            <span className="block text-[0.8125rem] font-semibold text-navy-900">EN · {CURRENCY.symbol} {CURRENCY.code}</span>
          </span>
        </button>
      )}
    >
      {() => <PreferenceFields idPrefix="header-pref" />}
    </Dropdown>
  );
}
