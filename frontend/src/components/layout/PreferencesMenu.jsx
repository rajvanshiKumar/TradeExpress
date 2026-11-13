import { useState } from 'react';
import { Check, ChevronDown, Coins, Globe, Info, MapPin } from 'lucide-react';
import Dropdown from '../common/Dropdown';
import CountryFlag from '../common/CountryFlag';
import useCurrency from '../../hooks/useCurrency';
import useLocationPreference from '../../hooks/useLocationPreference';
import { LocationForm } from './LocationSelector';

const tabClass = (active) => `flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
  active ? 'bg-white text-emerald-950 shadow-2xs font-extrabold' : 'hover:text-slate-900'
}`;

/** Choose the display currency by hand. It is kept until another currency or a new country is chosen. */
export function PreferenceCurrencyPicker() {
  const { currency, setCurrency, currencies } = useCurrency();
  const [saving, setSaving] = useState('');

  const chooseCurrency = async (code) => {
    if (saving || code === currency) return;
    setSaving(code);
    await setCurrency(code);
    setSaving('');
  };

  return (
        <div className="space-y-1.5">
          <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Display currency</div>
          <div className="ts-no-scrollbar max-h-56 space-y-1 overflow-y-auto pr-1">
            {currencies.map((c) => {
              const isSelected = currency === c.code;
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => chooseCurrency(c.code)}
                  aria-pressed={isSelected}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all ${
                    isSelected ? 'border-emerald-300/80 bg-emerald-50 text-emerald-950 shadow-2xs' : 'border-transparent text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100/80 text-[11px] font-bold text-emerald-900">{c.symbol}</span>
                    <span>
                      <span className="font-extrabold text-slate-900">{c.code}</span>
                      <span className="ml-1.5 text-[11px] text-slate-500">{c.name}</span>
                    </span>
                  </span>
                  {isSelected ? (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs">
                      <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-500">
            <Info className="mt-0.5 size-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
            <span>
              Prices are shown approximately in your currency, using daily rates from{' '}
              <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer" className="font-semibold underline">ExchangeRate-API</a>.
              You always pay in the supplier’s currency.
            </span>
          </p>
        </div>
  );
}

/** Location and display currency, shared by the mobile menu and the buyer profile. The website is always in English. */
export function PreferenceFields({ idPrefix = 'pref' }) {
  const [activeTab, setActiveTab] = useState('location'); // 'location' | 'currency'
  return (
    <div className="p-3.5 space-y-3.5">
      <div className="flex rounded-xl bg-slate-100/90 p-1 text-xs font-bold text-slate-600" role="tablist" aria-label="Preferences">
        <button type="button" role="tab" aria-selected={activeTab === 'location'} onClick={() => setActiveTab('location')} className={tabClass(activeTab === 'location')}>
          <MapPin className="size-3.5 text-emerald-700" aria-hidden="true" />
          <span>Location</span>
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'currency'} onClick={() => setActiveTab('currency')} className={tabClass(activeTab === 'currency')}>
          <Coins className="size-3.5 text-emerald-700" aria-hidden="true" />
          <span>Currency</span>
        </button>
      </div>
      {activeTab === 'location' ? <LocationForm idPrefix={`${idPrefix}-location`} /> : <PreferenceCurrencyPicker />}
    </div>
  );
}

/** Header dropdown with the same preferences. */
export default function PreferencesMenu() {
  const { location } = useLocationPreference();
  const { currency } = useCurrency();

  return (
    <Dropdown
      panelClassName="w-84 overflow-hidden p-0"
      trigger={({ open, props }) => (
        <button
          type="button"
          {...props}
          aria-label={`Location and currency: ${location.countryName}, ${currency}`}
          className="group inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/90 px-2.5 shadow-2xs sm:h-8.5 xl:h-9"
        >
          <CountryFlag code={location.countryCode} />
          <span className="text-xs font-bold text-slate-900">{currency}</span>
          <ChevronDown className={`size-3 text-slate-400 transition-transform duration-200 group-hover:text-slate-700 ${open ? 'rotate-180 text-emerald-700' : ''}`} aria-hidden="true" />
        </button>
      )}
    >
      {() => (
        <div>
          <div className="flex items-center gap-2.5 border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 px-4 py-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 shadow-2xs">
              <Globe className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">Preferences</h4>
              <p className="text-[11px] text-slate-500">Delivery location & display currency</p>
            </div>
          </div>
          <PreferenceFields idPrefix="header-pref" />
        </div>
      )}
    </Dropdown>
  );
}
