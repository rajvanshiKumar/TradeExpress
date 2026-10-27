import { useState, useId } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Globe, ExternalLink, AlertCircle, ArrowLeft, Check, ChevronDown } from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useTranslation } from '../i18n/LanguageContext';

export default function CountryRegion() {
  const { country, setCountry, supportedCountries, t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const selectId = useId();

  useDocumentTitle('Website (Country/Region) - TradeExpress');

  // Keep a local pending selection until confirmed or canceled
  const [selectedCountryName, setSelectedCountryName] = useState(country);
  const [statusMessage, setStatusMessage] = useState(null);

  const selectedCountry = supportedCountries.find((c) => c.name === selectedCountryName) || supportedCountries[0];

  const handleCancel = () => {
    // Return to previous page if in history, else navigate to home
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const handleGoToWebsite = () => {
    if (!selectedCountry) {
      setStatusMessage({ type: 'error', text: 'Please select a valid country/region website.' });
      return;
    }

    // Persist confirmed selection
    setCountry(selectedCountry.name);

    // Build the destination storefront URL
    const destinationUrl = `${window.location.origin}/?region=${selectedCountry.code.toLowerCase()}&country=${encodeURIComponent(selectedCountry.name)}`;

    // Open destination in a new browser tab consistent with reference design
    const openedTab = window.open(destinationUrl, '_blank', 'noopener,noreferrer');
    if (!openedTab) {
      // If popup blocker intervened, provide in-page notice
      setStatusMessage({
        type: 'info',
        text: `Your browser blocked opening a new tab. Please allow popups or visit: ${destinationUrl}`,
      });
    } else {
      setStatusMessage({
        type: 'success',
        text: `Opened TradeExpress ${selectedCountry.name} storefront in a new tab.`,
      });
    }
  };

  return (
    <div className="min-h-[75vh] bg-white py-8 sm:py-12 lg:py-16">
      <div className="ts-container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb / Back Link */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleCancel}
            className="group inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-950 transition-colors"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>{t('common.back', {}, 'Back')}</span>
          </button>
        </div>

        {/* Main Heading */}
        <div className="border-b border-slate-200 pb-4 mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {t('countryRegion.heading', {}, 'Website (Country/Region)')}
          </h1>
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Selector & Actions */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <label
                htmlFor={selectId}
                className="block text-sm sm:text-base font-bold text-slate-900 mb-2"
              >
                {t('countryRegion.sectionTitle', {}, 'Select your preferred country/region website')}
              </label>

              {/* Styled Dropdown Selector */}
              <div className="relative mt-2">
                <select
                  id={selectId}
                  value={selectedCountryName}
                  onChange={(e) => {
                    setSelectedCountryName(e.target.value);
                    setStatusMessage(null);
                  }}
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-4 pr-10 text-sm font-semibold text-slate-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                >
                  {supportedCountries.map((c) => (
                    <option key={c.code} value={c.name}>
                      {c.flag} {c.name} ({c.currency})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500">
                  <ChevronDown className="size-4" aria-hidden="true" />
                </div>
              </div>

              {/* Note below selector */}
              <p className="mt-3 text-xs text-slate-500 font-medium leading-relaxed">
                {t('countryRegion.note', {}, 'NOTE: A new country/region website selection will open in a new tab.')}
              </p>
            </div>

            {/* Status Feedback Notice */}
            {statusMessage && (
              <div
                className={`flex items-start gap-2.5 rounded-xl p-3.5 text-xs font-semibold ${
                  statusMessage.type === 'success'
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                    : statusMessage.type === 'info'
                    ? 'border border-blue-200 bg-blue-50 text-blue-900'
                    : 'border border-rose-200 bg-rose-50 text-rose-900'
                }`}
              >
                <Check className="size-4 shrink-0 mt-0.5" />
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* Horizontal Divider */}
            <div className="border-t border-slate-200 pt-6">
              {/* Buttons: Cancel & Go to website */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-all focus:outline-hidden focus:ring-2 focus:ring-slate-400"
                >
                  {t('countryRegion.cancel', {}, 'Cancel')}
                </button>

                <button
                  type="button"
                  onClick={handleGoToWebsite}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#FCD200] bg-[#FFD814] hover:bg-[#F7CA00] px-6 py-2.5 text-xs sm:text-sm font-bold text-slate-950 shadow-xs hover:shadow-sm transition-all focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                >
                  <span>{t('countryRegion.goToWebsite', {}, 'Go to website')}</span>
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Explanatory Box */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 sm:p-6 shadow-2xs">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-900 font-bold shrink-0">
                  <Globe className="size-4" />
                </span>
                <h2 className="text-sm font-black text-slate-900 tracking-tight">
                  {t('countryRegion.explainTitle', {}, 'Changing country/region website')}
                </h2>
              </div>
              <p className="text-xs sm:text-[13px] leading-relaxed text-slate-600 font-medium">
                {t(
                  'countryRegion.explainDesc',
                  {},
                  'Changing the country/region you shop from may affect factors including price, shipping options and product availability.'
                )}
              </p>

              {/* Current Active Market Info Card */}
              <div className="mt-5 rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    {t('countryRegion.currentBadge', {}, 'Current Market')}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-base" aria-hidden="true">{selectedCountry.flag}</span>
                    <span className="text-xs font-black text-slate-900">{selectedCountry.name}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Currency
                  </span>
                  <span className="text-xs font-black text-emerald-800">
                    {selectedCountry.currency} ({selectedCountry.currencySymbol})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
