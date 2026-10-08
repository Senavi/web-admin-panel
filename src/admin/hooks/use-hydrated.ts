import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/** False during SSR and hydration, true once the component runs on the client. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
