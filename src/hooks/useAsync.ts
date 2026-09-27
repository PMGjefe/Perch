import { useCallback, useEffect, useRef, useState } from 'react';

interface State<T> {
  data: T | null;
  error: string | null;
  key: string;
}

/** Minimal async loader with refresh. Keeps the last good value while reloading. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState<State<T>>({ data: null, error: null, key: '' });
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    fn()
      .then((data) => {
        if (id === seq.current) setState({ data, error: null, key });
      })
      .catch((e: unknown) => {
        if (id === seq.current) setState((s) => ({ data: s.key === key ? s.data : null, error: e instanceof Error ? e.message : String(e), key }));
      })
      .finally(() => {
        if (id === seq.current) setRefreshing(false);
      });
    // `fn` is intentionally not a dependency: callers pass an inline closure and list its inputs in `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setTick((t) => t + 1);
  }, []);

  const setData = useCallback((data: T | null) => setState((s) => ({ ...s, data })), []);

  const loading = state.key !== key || refreshing;
  return { data: state.key === key ? state.data : null, error: state.key === key ? state.error : null, loading, refreshing, reload, setData };
}
