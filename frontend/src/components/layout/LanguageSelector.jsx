import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Globe, ChevronDown, Check, ArrowRight, ExternalLink, HelpCircle } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

export default function LanguageSelector({ className = '' }) {
  const { language, setLanguage, country, currentLanguage, currentCountry, supportedLanguages, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectLanguage = (code) => {
    setLanguage(code);
    // Keep popover open briefly so user sees the radio state change, or let them close
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={menuRef}>
      {/* Header Language Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group inline-flex h-8 sm:h-8.5 xl:h-9 items-center gap-1.5 rounded-full border px-2.5 sm:px-3 text-left transition-all shadow-2xs ${
          isOpen
            ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20'
            : 'border-slate-200/90 bg-white/95 text-slate-800 hover:border-emerald-600/50 hover:bg-white'
        }`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`Language selector: Currently ${currentLanguage.label}`}
        title={`Change Language: ${currentLanguage.label} (${currentLanguage.short})`}
      >
        <span className="text-sm select-none leading-none shrink-0" aria-hidden="true">
          {currentCountry.flag || '🇮🇳'}
        </span>
        <span className="text-xs font-black tracking-tight text-slate-900 uppercase">
          {currentLanguage.short}
        </span>
        <ChevronDown
          className={`size-3 text-slate-400 transition-transform duration-200 group-hover:text-slate-700 ${
            isOpen ? 'rotate-180 text-emerald-700' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Language Popover / Dropdown Menu */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Language selection"
          className="absolute right-0 sm:right-auto sm:left-0 mt-2 w-76 sm:w-80 rounded-2xl border border-slate-200/95 bg-white p-3.5 shadow-xl ring-1 ring-slate-900/5 z-[100] animate-in fade-in zoom-in-95 duration-150 origin-top-right sm:origin-top-left"
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-black text-slate-900 tracking-tight">
                {t('language.title', {}, 'Change Language')}
              </h3>
            </div>
            <Link
              to="/help"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:text-emerald-900 hover:underline"
            >
              <span>{t('language.learnMore', {}, 'Learn more')}</span>
              <HelpCircle className="size-3" />
            </Link>
          </div>

          {/* Language Radio Options List */}
          <div className="space-y-1 max-h-64 overflow-y-auto ts-no-scrollbar pr-0.5">
            {supportedLanguages.map((lang) => {
              const isSelected = language === lang.code;
              return (
                <label
                  key={lang.code}
                  onClick={() => handleSelectLanguage(lang.code)}
                  className={`flex items-center justify-between w-full px-2.5 py-2 rounded-xl cursor-pointer text-xs transition-colors select-none ${
                    isSelected
                      ? 'bg-emerald-50/80 text-emerald-950 font-bold border border-emerald-300/80'
                      : 'hover:bg-slate-50 text-slate-700 border border-transparent font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {/* Amazon-style Radio Button */}
                    <div
                      className={`relative flex size-4 items-center justify-center rounded-full border transition-all ${
                        isSelected
                          ? 'border-emerald-700 bg-emerald-700'
                          : 'border-slate-300 bg-white hover:border-slate-400'
                      }`}
                    >
                      {isSelected && <span className="size-1.5 rounded-full bg-white" />}
                    </div>

                    {/* Language Native Name & English label */}
                    <span className="text-xs text-slate-900">
                      {lang.nativeName}
                      {lang.label !== lang.nativeName && (
                        <span className="text-[11px] text-slate-500 font-normal ml-1">
                          ({lang.label})
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Language Code Tag */}
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                      isSelected
                        ? 'bg-emerald-200/80 text-emerald-950'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {lang.short}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Divider between Languages and Country/Region */}
          <div className="my-2.5 border-t border-slate-200" />

          {/* Country / Region Section */}
          <div className="rounded-xl bg-slate-50/90 p-2.5 border border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-700 leading-snug">
              <span className="text-base shrink-0" aria-hidden="true">
                {currentCountry.flag || '🌐'}
              </span>
              <span>
                {t('country.shoppingOn', { country: currentCountry.name }, `You are shopping on TradeExpress ${currentCountry.name}.`)}
              </span>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between">
              <Link
                to="/country-region"
                onClick={() => setIsOpen(false)}
                className="group inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 hover:underline"
              >
                <span>{t('country.change', {}, 'Change country/region')}</span>
                <ArrowRight className="size-3 text-emerald-700 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <span
                className="text-base select-none leading-none shrink-0"
                aria-label={currentCountry.name}
                title={currentCountry.name}
              >
                {currentCountry.flag || '🇮🇳'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
