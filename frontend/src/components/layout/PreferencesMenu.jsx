import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Coins, Globe, MapPin, Sparkles, ExternalLink } from 'lucide-react';
import Dropdown from '../common/Dropdown';
import useAuth from '../../hooks/useAuth';
import useCurrency from '../../hooks/useCurrency';
import { useTranslation } from '../../i18n/LanguageContext';
import { COUNTRIES, COUNTRY_FLAGS, LANGUAGES } from '../../utils/constants';

/** Region, language and currency selects, shared by the header dropdown and the mobile menu. */
export function PreferenceFields({ idPrefix = 'pref' }) {
  const { preferences, setPreferences } = useAuth();
  const { language, setLanguage, country, setCountry } = useTranslation();
  const { currency, setCurrency, currencies } = useCurrency();
  const [activeTab, setActiveTab] = useState('currency'); // 'currency' | 'country' | 'language'

  return (
    <div className="p-3.5 space-y-3.5">
      {/* Segmented Switcher Tabs */}
      <div className="flex rounded-xl bg-slate-100/90 p-1 text-xs font-bold text-slate-600">
        <button
          type="button"
          onClick={() => setActiveTab('currency')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
            activeTab === 'currency'
              ? 'bg-white text-emerald-950 shadow-2xs font-extrabold'
              : 'hover:text-slate-900'
          }`}
        >
          <Coins className="size-3.5 text-emerald-700" />
          <span>Currency</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('country')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
            activeTab === 'country'
              ? 'bg-white text-emerald-950 shadow-2xs font-extrabold'
              : 'hover:text-slate-900'
          }`}
        >
          <MapPin className="size-3.5 text-emerald-700" />
          <span>Ship To</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('language')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
            activeTab === 'language'
              ? 'bg-white text-emerald-950 shadow-2xs font-extrabold'
              : 'hover:text-slate-900'
          }`}
        >
          <Globe className="size-3.5 text-emerald-700" />
          <span>Language</span>
        </button>
      </div>

      {/* Tab 1: Currency Selection */}
      {activeTab === 'currency' && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
            Select Wholesale Currency
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1 pr-1 ts-no-scrollbar">
            {currencies.map((c) => {
              const isSelected = currency === c.code;
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setCurrency(c.code)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-950 border border-emerald-300/80 shadow-2xs'
                      : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-100/80 text-emerald-900 font-bold shrink-0 text-xs">
                      {c.symbol}
                    </span>
                    <div>
                      <span className="font-extrabold text-slate-900">{c.code}</span>
                      <span className="text-slate-500 text-[11px] ml-1.5">{c.name}</span>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs shrink-0">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Destination Country */}
      {activeTab === 'country' && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
            Shipping Destination Country
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1 pr-1 ts-no-scrollbar">
            {COUNTRIES.map((c) => {
              const isSelected = (country || preferences.country) === c;
              const flag = COUNTRY_FLAGS[c] || '🌐';
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCountry(c);
                    setPreferences({ country: c });
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-950 border border-emerald-300/80 shadow-2xs'
                      : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base shrink-0">{flag}</span>
                    <span className="font-bold text-slate-900">{c}</span>
                  </div>
                  {isSelected && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs shrink-0">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <Link
              to="/country-region"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 hover:underline"
            >
              <span>Change country/region website</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Tab 3: Language */}
      {activeTab === 'language' && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
            Interface Language
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1 pr-1 ts-no-scrollbar">
            {LANGUAGES.map((item) => {
              const isSelected = (language || preferences.language) === item.code;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    setLanguage(item.code);
                    setPreferences({ language: item.code });
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-950 border border-emerald-300/80 shadow-2xs'
                      : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-slate-900">
                      {item.nativeName || item.label}
                    </span>
                    {item.label !== item.nativeName && (
                      <span className="text-[11px] text-slate-500 font-normal">
                        ({item.label})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {item.short || item.code.toUpperCase()}
                    </span>
                    {isSelected && (
                      <span className="flex size-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs shrink-0">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Informative Rate Notice */}
      <div className="rounded-xl bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-500 border border-slate-100 flex items-start gap-2">
        <Sparkles className="size-3.5 text-emerald-700 shrink-0 mt-0.5" />
        <span>Base listings are priced in INR. Rates auto-convert for real-time wholesale preview.</span>
      </div>
    </div>
  );
}

export default function PreferencesMenu() {
  const { preferences } = useAuth();
  const { currentCountry } = useTranslation();
  const { currency, currencies } = useCurrency();
  const activeCur = currencies.find((c) => c.code === currency) || { symbol: '₹', code: 'INR' };
  const flag = currentCountry.flag || COUNTRY_FLAGS[preferences.country] || '🇮🇳';

  return (
    <Dropdown
      panelClassName="w-84 overflow-hidden p-0"
      trigger={({ open, props }) => (
        <button
          type="button"
          {...props}
          aria-label={`Region and language: ${preferences.country}, English, ${activeCur.code}`}
          title={`Preferences: ${preferences.country} · ${activeCur.code}`}
          className="group inline-flex h-8 sm:h-8.5 xl:h-9 items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/90 px-2.5 sm:px-3 text-left hover:border-emerald-600/40 hover:bg-white transition-all shadow-2xs text-slate-800"
        >
          <span className="text-sm shrink-0 select-none" aria-hidden="true">{flag}</span>
          <span className="text-xs font-bold text-slate-900">
            {activeCur.code}
          </span>
          <ChevronDown
            className={`size-3 text-slate-400 transition-transform duration-200 group-hover:text-slate-700 ${
              open ? 'rotate-180 text-emerald-700' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      )}
    >
      {() => (
        <div>
          {/* Header Banner */}
          <div className="flex items-center gap-2.5 border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 px-4 py-3">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 shrink-0 shadow-2xs">
              <Globe className="size-4" />
            </span>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Global Preferences
              </h4>
              <p className="text-[11px] text-slate-500">Destination, language & wholesale currency</p>
            </div>
          </div>

          <PreferenceFields idPrefix="header-pref" />
        </div>
      )}
    </Dropdown>
  );
}
