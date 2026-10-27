import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { STORAGE_KEYS } from '../utils/constants';
import { SUPPORTED_LANGUAGES, SUPPORTED_COUNTRIES } from './languages';

import en from './locales/en.json';
import hi from './locales/hi.json';
import te from './locales/te.json';
import ta from './locales/ta.json';
import kn from './locales/kn.json';
import ml from './locales/ml.json';
import bn from './locales/bn.json';
import mr from './locales/mr.json';

const translations = { en, hi, te, ta, kn, ml, bn, mr };

export const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  // 1. Language state with persistent hydration
  const [language, setLanguageState] = useState(() => {
    try {
      const stored = localStorage.getItem('tradeexpress_language') || localStorage.getItem('tradesphere_language');
      if (stored && translations[stored]) return stored;

      const rawPrefs = localStorage.getItem(STORAGE_KEYS.preferences);
      if (rawPrefs) {
        const parsed = JSON.parse(rawPrefs);
        if (parsed.language && translations[parsed.language]) return parsed.language;
      }
    } catch {
      // Fallback to English
    }
    return 'en';
  });

  // 2. Country / Region state with persistent hydration
  const [country, setCountryState] = useState(() => {
    try {
      const stored = localStorage.getItem('tradeexpress_country') || localStorage.getItem('tradesphere_country');
      if (stored) return stored;

      const rawPrefs = localStorage.getItem(STORAGE_KEYS.preferences);
      if (rawPrefs) {
        const parsed = JSON.parse(rawPrefs);
        if (parsed.country) return parsed.country;
      }
    } catch {
      // Fallback to India
    }
    return 'India';
  });

  // Sync document html lang attribute
  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch {
      // Ignore
    }
  }, [language]);

  // Language setter
  const setLanguage = useCallback((code) => {
    if (!translations[code]) return;
    setLanguageState(code);
    try {
      localStorage.setItem('tradeexpress_language', code);
      localStorage.setItem('tradesphere_language', code);

      const rawPrefs = localStorage.getItem(STORAGE_KEYS.preferences);
      const parsed = rawPrefs ? JSON.parse(rawPrefs) : {};
      localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify({ ...parsed, language: code }));
    } catch {
      // Ignore localStorage issues
    }
  }, []);

  // Country setter
  const setCountry = useCallback((countryName) => {
    setCountryState(countryName);
    try {
      localStorage.setItem('tradeexpress_country', countryName);
      localStorage.setItem('tradesphere_country', countryName);

      const rawPrefs = localStorage.getItem(STORAGE_KEYS.preferences);
      const parsed = rawPrefs ? JSON.parse(rawPrefs) : {};
      localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify({ ...parsed, country: countryName }));
    } catch {
      // Ignore localStorage issues
    }
  }, []);

  // Translation function t(key, params, fallback)
  const t = useCallback(
    (key, params = {}, fallback = '') => {
      const activeLocale = translations[language] || translations.en;
      let text = activeLocale[key] || translations.en[key] || fallback || key;
      if (params && typeof params === 'object') {
        Object.entries(params).forEach(([k, val]) => {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(val));
        });
      }
      return text;
    },
    [language]
  );

  const currentLanguage = useMemo(
    () => SUPPORTED_LANGUAGES.find((item) => item.code === language) || SUPPORTED_LANGUAGES[0],
    [language]
  );

  const currentCountry = useMemo(
    () =>
      SUPPORTED_COUNTRIES.find(
        (item) =>
          item.name === country ||
          item.code === country ||
          item.name.toLowerCase() === (country || '').toLowerCase() ||
          item.code.toLowerCase() === (country || '').toLowerCase()
      ) || SUPPORTED_COUNTRIES[0],
    [country]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      country,
      setCountry,
      t,
      currentLanguage,
      currentCountry,
      supportedLanguages: SUPPORTED_LANGUAGES,
      supportedCountries: SUPPORTED_COUNTRIES,
    }),
    [language, setLanguage, country, setCountry, t, currentLanguage, currentCountry]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Graceful fallback if invoked outside provider
    return {
      language: 'en',
      setLanguage: () => {},
      country: 'India',
      setCountry: () => {},
      t: (key, _params, fallback) => fallback || key,
      currentLanguage: SUPPORTED_LANGUAGES[0],
      currentCountry: SUPPORTED_COUNTRIES[0],
      supportedLanguages: SUPPORTED_LANGUAGES,
      supportedCountries: SUPPORTED_COUNTRIES,
    };
  }
  return context;
}

export default LanguageContext;
