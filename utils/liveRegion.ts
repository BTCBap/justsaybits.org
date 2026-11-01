import { useSyncExternalStore } from 'react';

export interface LiveMessage {
  id: number;
  text: string;
}

let latest: LiveMessage | null = null;
let sequence = 0;
const listeners = new Set<() => void>();

/** Announce a short status message through the app's polite live region. */
export const announce = (text: string) => {
  latest = { id: ++sequence, text };
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useLiveMessage(): LiveMessage | null {
  return useSyncExternalStore(subscribe, () => latest, () => null);
}
