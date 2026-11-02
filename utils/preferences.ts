import { useSyncExternalStore } from 'react';

export interface Preferences {
  sound: boolean;
  haptics: boolean;
  soundHintDismissed: boolean;
}

const STORAGE_KEY = 'jsb.prefs.v3';
/**
 * Earlier builds stored a sound flag that may be a default rather than a
 * choice. Only the non-audio preferences migrate; sound starts off again.
 */
const LEGACY_STORAGE_KEYS = ['jsb.prefs.v2', 'jsb.prefs.v1'] as const;

const DEFAULTS: Preferences = {
  sound: false,
  haptics: true,
  soundHintDismissed: false,
};

/**
 * Read the newest legacy record once, keep haptics and the hint, and write v3
 * muted. Sound is off for everyone after migration, including visitors who
 * turned it on before.
 */
const migrateLegacy = (): Preferences => {
  let haptics = DEFAULTS.haptics;
  let soundHintDismissed = false;
  try {
    for (const key of LEGACY_STORAGE_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<Preferences>;
      if (typeof parsed.haptics === 'boolean') haptics = parsed.haptics;
      soundHintDismissed = parsed.soundHintDismissed === true;
      break;
    }
  } catch {
    // Unreadable legacy record: fall back to the defaults.
  }

  const stored: Preferences = { sound: false, haptics, soundHintDismissed };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    LEGACY_STORAGE_KEYS.forEach(key => window.localStorage.removeItem(key));
  } catch {
    // Keep the migrated values in memory when storage is read-only.
  }
  return stored;
};

const read = (): Preferences => {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrateLegacy();
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      sound: parsed.sound === true,
      haptics: typeof parsed.haptics === 'boolean' ? parsed.haptics : DEFAULTS.haptics,
      soundHintDismissed: parsed.soundHintDismissed === true,
    };
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
