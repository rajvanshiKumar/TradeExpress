import { useEffect } from 'react';
import useAuth from '../../hooks/useAuth';
import { getPreferences, updatePreferences } from '../../services/accountApi';
import { hasChosenLocation, readLocation, writeLocation } from '../../utils/locationStore';

/**
 * Brings the signed-in account's saved location and display currency to this device, so they follow the user everywhere.
 * If the account has never saved one, a choice made on this device before signing in is saved to the account instead.
 * The website itself is always in English. Runs once per sign-in; renders nothing.
 */
export default function PreferenceSync() {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    getPreferences()
      .then((data) => {
        if (!active) return;
        const saved = data?.preferences?.location;
        if (saved?.savedAt) {
          writeLocation(saved);
        } else if (hasChosenLocation()) {
          updatePreferences({ location: readLocation() }).catch(() => {});
        }
      })
      .catch(() => {
        // Not signed in on the server (or offline): keep this device's choice
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return null;
}
