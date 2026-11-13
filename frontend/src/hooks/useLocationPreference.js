import { useCallback, useEffect, useState } from 'react';
import useAuth from './useAuth';
import { updatePreferences } from '../services/accountApi';
import { LOCATION_EVENT, readLocation, writeLocation } from '../utils/locationStore';

const ACCOUNT_ROLES = ['buyer', 'supplier', 'super_admin'];

/**
 * The buyer's country, postal code and display currency.
 * Saving updates this device at once; for signed-in users it is also saved to the account, so it follows them to other devices.
 */
export default function useLocationPreference() {
  const { user } = useAuth();
  const [location, setLocation] = useState(readLocation);

  useEffect(() => {
    const sync = (event) => setLocation(event?.detail || readLocation());
    const onStorage = (event) => {
      if (event.key === 'tradeexpress_location') sync();
    };
    window.addEventListener(LOCATION_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(LOCATION_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const signedIn = Boolean(user && ACCOUNT_ROLES.includes(user.role));

  /** Resolves to { ok: true } or { ok: false, message } when the account could not be updated (this device is still updated). */
  const saveLocation = useCallback(async (next) => {
    const saved = writeLocation({ ...next, savedAt: new Date().toISOString() });
    if (!signedIn) return { ok: true, location: saved };
    try {
      await updatePreferences({ location: saved });
      return { ok: true, location: saved };
    } catch (error) {
      return { ok: false, location: saved, message: error.message || 'Saved on this device, but your account could not be updated.' };
    }
  }, [signedIn]);

  /** A currency chosen by hand is kept until the user picks another or chooses a new country. */
  const setDisplayCurrency = useCallback(
    (code) => saveLocation({ ...readLocation(), displayCurrency: code, currencyManual: true }),
    [saveLocation],
  );

  return { location, saveLocation, setDisplayCurrency, signedIn };
}
