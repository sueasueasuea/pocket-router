import { useSyncExternalStore } from 'react';
import { usePocketRouterStore } from './usePocketRouterStore';

/**
 * Returns true once the Zustand `persist` middleware has finished hydrating
 * from localStorage. Use this in place of the
 * `useState(false) + useEffect(() => setMounted(true), [])` pattern.
 *
 * - On the server (and during the first client render before hydration),
 *   returns `false` so React markup matches what the server would emit.
 * - After the browser finishes reading the persisted state, returns `true`
 *   and triggers a re-render so client-only data can be displayed.
 *
 * Implementation note: `useSyncExternalStore` is the React 19 / Next 16
 * blessed primitive for subscribing to external stores. It avoids the
 * `react-hooks/set-state-in-effect` lint rule because the snapshot is read
 * synchronously and re-reads happen only via the subscribed callback.
 *
 * Defensive notes:
 * - During Next.js SSG/SSR, `usePocketRouterStore.persist` may be undefined
 *   (the middleware attaches lazily in some bundler/runtime combinations).
 *   Every access is therefore guarded with `?.` and the subscribe returns a
 *   no-op unsubscribe so React can still call it without crashing.
 */
export function useHasHydrated(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const persistApi = usePocketRouterStore.persist;
      if (!persistApi) return () => {};
      return persistApi.onFinishHydration(notify);
    },
    () => usePocketRouterStore.persist?.hasHydrated() ?? false,
    () => false
  );
}