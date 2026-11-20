import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads a collection through a service (a Promise, like an API call), keeps it in
 * state, and saves it back whenever it changes.
 * Returns { items, setItems, loading, error, reload, refresh }.
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

  // When the data last arrived, and whether a load is running: lets a page refresh without duplicate requests
  const loadedAt = useRef(0);
  const inFlight = useRef(false);
  useEffect(() => {
    if (!state.loading) {
      inFlight.current = false;
      if (!state.error) loadedAt.current = Date.now();
    } else {
      inFlight.current = true;
    }
  }, [state.loading, state.error]);

  /**
   * Quiet refresh for a page that is opened: only this collection's request, the list on screen stays (no loading
   * skeleton) and is replaced when the new data arrives. Skipped while a load is running or when the data is
   * only a few seconds old, so opening a page right after sign-in never sends the same request twice.
   */
  const refresh = useCallback((maxAgeMs = 5000) => {
    if (inFlight.current || Date.now() - loadedAt.current < maxAgeMs) return;
    inFlight.current = true;
    const current = ++request.current;
    load()
      .then((items) => {
        if (current !== request.current) return;
        loaded.current = true;
        loadedAt.current = Date.now();
        setState({ items, loading: false, error: '' });
      })
      .catch(() => {
        // The list already on screen stays; the next refresh tries again
      })
      .finally(() => {
        if (current === request.current) inFlight.current = false;
      });
  }, [load]);

  const setItems = useCallback((updater) => {
    setState((previous) => ({ ...previous, items: typeof updater === 'function' ? updater(previous.items) : updater }));
  }, []);

  useEffect(() => {
    if (loaded.current) save(state.items);
  }, [state.items, save]);

  return { items: state.items, setItems, loading: state.loading, error: state.error, reload, refresh };
}
