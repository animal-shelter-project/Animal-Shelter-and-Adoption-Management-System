import { useEffect, useEffectEvent, useState } from 'react';
import { isAbort } from './api.js';

// Returns `value` after it has stopped changing for `delay` ms.
// Used for the breed text box so we don't call the API on every keystroke.
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Keeps list and profile statuses fresh (e.g. staff approved an application
// in another browser) without a manual reload:
//  - runs `callback` when the tab becomes visible / window regains focus,
//    at most once per `minIntervalMs` so focus events don't spam the API
//  - optionally also every `pollMs` while the tab is visible
export function useRefetchOnFocus(callback, { minIntervalMs = 5000, pollMs = 0 } = {}) {
  const onRefetch = useEffectEvent(callback);

  useEffect(() => {
    let last = Date.now();
    const run = () => {
      if (Date.now() - last < minIntervalMs) return;
      last = Date.now();
      onRefetch();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', onVisible);
    const poll = pollMs > 0 ? setInterval(onVisible, pollMs) : null;
    return () => {
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', onVisible);
      if (poll) clearInterval(poll);
    };
  }, [minIntervalMs, pollMs]);
}

// Loads data for `key` with `fetcher(signal)` and keeps it fresh.
//
//   const { data, previousData, error, loading, reload } =
//     useResource(`animal:${id}`, (signal) => api.getAnimal(id, { signal }));
//
//  - When `key` changes, the old request is cancelled (AbortController), so a
//    slow old response can never overwrite a newer one.
//  - `data` belongs to the current key only; `previousData` is whatever was
//    shown last (handy for keeping a list on screen while it updates).
//  - `reload()` retries after an error (shows loading again).
//  - Refreshes in the background on focus / every `pollMs`; if a background
//    refresh fails, the current data stays on screen instead of an error.
export function useResource(key, fetcher, { pollMs = 0, refetchOnFocus = true } = {}) {
  const [result, setResult] = useState({ key: null, data: undefined, error: null });
  const [run, setRun] = useState({ n: 0, background: false });
  const fetchNow = useEffectEvent((signal) => fetcher(signal));

  useEffect(() => {
    const controller = new AbortController();
    const { background } = run;
    Promise.resolve()
      .then(() => fetchNow(controller.signal))
      .then(
        (data) => {
          if (!controller.signal.aborted) setResult({ key, data, error: null });
        },
        (error) => {
          if (controller.signal.aborted || isAbort(error)) return;
          setResult((prev) =>
            background && prev.key === key && prev.data !== undefined
              ? prev
              : { key, data: undefined, error, previous: prev.data ?? prev.previous },
          );
        },
      );
    return () => controller.abort();
  }, [key, run]);

  const refresh = () => setRun((r) => ({ n: r.n + 1, background: true }));
  useRefetchOnFocus(refresh, { pollMs: refetchOnFocus ? pollMs : 0, minIntervalMs: refetchOnFocus ? 5000 : Infinity });

  const isCurrent = result.key === key;
  return {
    data: isCurrent ? result.data : undefined,
    previousData: result.data ?? result.previous,
    error: isCurrent ? result.error : null,
    loading: !isCurrent,
    reload: () => {
      setResult((prev) => ({ key: null, data: undefined, error: null, previous: prev.data ?? prev.previous }));
      setRun((r) => ({ n: r.n + 1, background: false }));
    },
    refresh,
  };
}

// Sets the browser tab title, e.g. "Buddy · Paws Shelter".
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Paws Shelter` : 'Paws Shelter';
  }, [title]);
}
