import { useCallback, useEffect, useState } from 'react';
import { fullKey, readStorage, writeStorage } from '../utils/storage';

/**
 * useState that is saved to localStorage under `key`.
 * The seed value is used only when nothing valid is stored yet.
 * With `syncWindows`, changes from other windows are picked up, so this window cannot overwrite them with an old copy.
 */
export default function useLocalStorage(key, seed, { syncWindows = false } = {}) {
  const [value, setValue] = useState(() => readStorage(key, typeof seed === 'function' ? seed() : seed));

  useEffect(() => {
    writeStorage(key, value);
  }, [key, value]);

  useEffect(() => {
    if (!syncWindows) return undefined;
    const onStorage = (event) => {
      if (event.key === fullKey(key)) setValue((current) => readStorage(key, current));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, syncWindows]);

  const reset = useCallback(() => setValue(typeof seed === 'function' ? seed() : seed), [seed]);

  return [value, setValue, reset];
}
