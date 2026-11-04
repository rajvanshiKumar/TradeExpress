import { useEffect, useRef } from 'react';
import useAuth from '../../hooks/useAuth';
import { useTranslation } from '../../i18n/LanguageContext';
import { getPreferences } from '../../services/accountApi';

/**
 * Applies the signed-in account's saved language and region (Account Settings > Language Preferences), so they
 * follow the user to every device. Runs once per sign-in; renders nothing.
 */
export default function PreferenceSync() {
  const { user } = useAuth();
  const { language, country, setLanguage, setCountry } = useTranslation();
  // Latest values without re-running the sync when they change
  const current = useRef({ language, country, setLanguage, setCountry });
  useEffect(() => {
    current.current = { language, country, setLanguage, setCountry };
  }, [language, country, setLanguage, setCountry]);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    getPreferences()
      .then((data) => {
        const saved = data?.preferences?.language;
        if (!active || !saved) return;
        const now = current.current;
        if (saved.language && saved.language !== now.language) now.setLanguage(saved.language);
        if (saved.country && saved.country !== now.country) now.setCountry(saved.country);
      })
      .catch(() => {
        // Not signed in on the server (or offline): keep this device's current language
      });
    return () => { active = false; };
  }, [userId]);

  return null;
}
