import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads a collection through a service (a Promise, like an API call), keeps it in
 * state, and saves it back whenever it changes.
 * Returns { items, setItems, loading, error, reload }.
 */
export default function useCollection(load, save, getInitial) {
  const [state, setState] = useState(() => {
    const initial = typeof getInitial === 'function' ? getInitial() : [];
    return {
      items: initial,
      loading: initial.length === 0,
      error: '',
    };
  });
  const loaded = useRef(false);
  const request = useRef(0);

  const reload = useCallback(() => {
    const current = ++request.current;
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    load()
      .then((items) => {
        if (current !== request.current) return;
        loaded.current = true;
        setState({ items, loading: false, error: '' });
      })
      .catch((error) => {
        if (current !== request.current) return;
        setState({ items: [], loading: false, error: error?.message || 'The data could not be loaded.' });
      });
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setItems = useCallback((updater) => {
    setState((previous) => ({ ...previous, items: typeof updater === 'function' ? updater(previous.items) : updater }));
  }, []);

  useEffect(() => {
    if (loaded.current) save(state.items);
  }, [state.items, save]);

  return { items: state.items, setItems, loading: state.loading, error: state.error, reload };
}
