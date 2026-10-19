import { Globe } from 'lucide-react';
import Dropdown from '../common/Dropdown';
import Select from '../common/Select';
import useAuth from '../../hooks/useAuth';
import useCurrency from '../../hooks/useCurrency';
import { COUNTRIES, LANGUAGES } from '../../utils/constants';

/** Region, language and currency selects, shared by the header dropdown and the mobile menu. */
export function PreferenceFields({ idPrefix = 'pref' }) {
  const { preferences, setPreferences } = useAuth();
  const { currency, setCurrency, currencies } = useCurrency();

  return (
    <div className="space-y-3">
      <Select
        id={`${idPrefix}-country`}
        label="Ship to"
        value={preferences.country}
        onChange={(event) => setPreferences({ country: event.target.value })}
        options={COUNTRIES}
      />
      <Select
        id={`${idPrefix}-language`}
        label="Language"
        value={preferences.language}
        onChange={(event) => setPreferences({ language: event.target.value })}
        options={LANGUAGES.map((item) => ({ value: item.code, label: item.label }))}
      />
      <div>
        <label htmlFor={`${idPrefix}-currency`} className="ts-label block mb-1">
          Wholesale Currency
        </label>
        <select
          id={`${idPrefix}-currency`}
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="ts-input w-full font-semibold"
        >
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.symbol} {c.code} - {c.name}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[0.8125rem] text-muted">
          Base listings are in INR. Exchange rates automatically convert for international wholesale preview.
        </p>
      </div>
    </div>
  );
}

export default function PreferencesMenu() {
  const { preferences } = useAuth();
  const { currency, currencies } = useCurrency();
  const activeCur = currencies.find((c) => c.code === currency) || { symbol: '₹', code: 'INR' };

  return (
    <Dropdown
      panelClassName="w-72 p-4"
      trigger={({ props }) => (
        <button
          type="button"
          {...props}
          aria-label={`Region and language: ${preferences.country}, English, ${activeCur.code}`}
          className="inline-flex h-11 items-center gap-1.5 rounded-[0.625rem] px-2.5 text-left hover:bg-navy-50"
        >
          <Globe className="size-5 text-navy-900" aria-hidden="true" />
          <span className="leading-tight">
            <span className="block max-w-24 truncate text-[0.6875rem] text-muted">{preferences.country}</span>
            <span className="block text-[0.8125rem] font-semibold text-navy-900">
              EN · {activeCur.symbol} {activeCur.code}
            </span>
          </span>
        </button>
      )}
    >
      {() => <PreferenceFields idPrefix="header-pref" />}
    </Dropdown>
  );
}
