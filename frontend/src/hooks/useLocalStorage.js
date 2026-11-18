import { useCallback, useEffect, useState } from 'react';
import { fullKey, readStorage, writeStorage } from '../utils/storage';

/**
 * useState that is saved to localStorage under `key`.
 * The seed value is used only when nothing valid is stored yet.
 * When `key` changes (e.g. a per-user key after switching accounts) the value of the NEW key is loaded; the
 * previous key's value is never copied into it.
 * With `syncWindows`, changes from other windows are picked up, so this window cannot overwrite them with an old copy.
 */
export default function useLocalStorage(key, seed, { syncWindows = false } = {}) {
  const seedValue = () => (typeof seed === 'function' ? seed() : seed);
  const [state, setState] = useState(() => ({ key, value: readStorage(key, seedValue()) }));

  // Key changed: switch to that key's stored value during render (no write of the old value to the new key)
  let current = state;
  if (state.key !== key) {
    current = { key, value: readStorage(key, seedValue()) };
    setState(current);
  }

  useEffect(() => {
    writeStorage(state.key, state.value);
  }, [state]);

  useEffect(() => {
    if (!syncWindows) return undefined;
    const onStorage = (event) => {
      if (event.key === fullKey(key)) setState((prev) => (prev.key === key ? { key, value: readStorage(key, prev.value) } : prev));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, syncWindows]);

  const setValue = useCallback((next) => {
    setState((prev) => ({ key: prev.key, value: typeof next === 'function' ? next(prev.value) : next }));
  }, []);

  const reset = useCallback(() => setValue(typeof seed === 'function' ? seed() : seed), [seed, setValue]);

  return [current.value, setValue, reset];
}
