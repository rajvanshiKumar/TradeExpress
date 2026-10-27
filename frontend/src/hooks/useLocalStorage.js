import { useCallback, useEffect, useState } from 'react';
import { readStorage, writeStorage } from '../utils/storage';

/**
 * useState that is saved to localStorage under `key`.
 * The seed value is used only when nothing valid is stored yet.
 */
export default function useLocalStorage(key, seed) {
  const [value, setValue] = useState(() => readStorage(key, typeof seed === 'function' ? seed() : seed));

  useEffect(() => {
    writeStorage(key, value);
  }, [key, value]);

  const reset = useCallback(() => setValue(typeof seed === 'function' ? seed() : seed), [seed]);

  return [value, setValue, reset];
}
