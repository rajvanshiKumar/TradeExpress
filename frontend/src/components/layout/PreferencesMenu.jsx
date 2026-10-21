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
          title={`Preferences: ${preferences.country} · ${activeCur.code}`}
          className="inline-flex h-8 sm:h-8.5 xl:h-9 items-center gap-1 sm:gap-1.5 rounded-full px-2 text-left hover:bg-navy-900/5 transition-colors text-navy-800"
        >
          <Globe className="size-3.5 sm:size-4" aria-hidden="true" />
          <span className="text-xs font-bold text-navy-900">
            {activeCur.code}
          </span>
        </button>
      )}
    >
      {() => <PreferenceFields idPrefix="header-pref" />}
    </Dropdown>
  );
}
