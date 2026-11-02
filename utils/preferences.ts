import { useSyncExternalStore } from 'react';

export interface Preferences {
  sound: boolean;
  haptics: boolean;
  soundHintDismissed: boolean;
}

const STORAGE_KEY = 'jsb.prefs.v1';

const DEFAULTS: Preferences = {
  sound: true,
  haptics: true,
  soundHintDismissed: false,
};

const read = (): Preferences => {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Preferences> & { motion?: unknown };
    const stored: Preferences = {
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULTS.sound,
      haptics: typeof parsed.haptics === 'boolean' ? parsed.haptics : DEFAULTS.haptics,
      soundHintDismissed: parsed.soundHintDismissed === true,
    };
    // Older builds stored a manual motion override. Drop it so every visitor
    // follows the device setting again.
    if ('motion' in parsed) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      } catch {
        // Keep the sanitized values in memory when storage is read-only.
      }
    }
    return stored;
  } catch {
    return { ...DEFAULTS };
  }
};

let current: Preferences = read();
const listeners = new Set<() => void>();

const write = (value: Preferences) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, quota); the in-memory value
    // still applies for this visit.
  }
};

export const preferences = {
  get: (): Preferences => current,
  set: (patch: Partial<Preferences>) => {
    const next = { ...current, ...patch };
    if (
      next.sound === current.sound &&
      next.haptics === current.haptics &&
      next.soundHintDismissed === current.soundHintDismissed
    ) {
      return;
    }
    current = next;
    write(next);
    listeners.forEach(listener => listener());
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export const isCoarsePointer = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse)').matches;
};

export const prefersReducedMotionNow = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export const canVibrate = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function usePreferences(): Preferences {
  return useSyncExternalStore(preferences.subscribe, preferences.get, preferences.get);
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const media = window.matchMedia(query);
      media.addEventListener('change', notify);
      return () => media.removeEventListener('change', notify);
    },
    () => (typeof window !== 'undefined' && !!window.matchMedia
      ? window.matchMedia(query).matches
      : false),
    () => false,
  );
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

export const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /iP(hone|ad|od)/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/**
 * iOS Safari has no Vibration API, but a hidden switch checkbox toggled from
 * a user gesture plays the system haptic on iOS 18+. iPadOS reports itself as
 * a Mac, so `isIOS` covers both.
 */
export const canUseIOSHapticFallback = (): boolean =>
  isIOS() && typeof document !== 'undefined'
  && typeof navigator !== 'undefined' && /AppleWebKit/i.test(navigator.userAgent);

export function useHapticsAvailable(): boolean {
  const coarse = useMediaQuery('(pointer: coarse)');
  return canUseIOSHapticFallback() || (coarse && canVibrate());
}
