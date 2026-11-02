import { useSyncExternalStore } from 'react';

/**
 * The site keeps no interface preferences. Earlier builds stored sound,
 * haptics and hint flags under these keys; clear them once so a returning
 * visitor's browser carries no stale state.
 */
const RETIRED_STORAGE_KEYS = ['jsb.prefs.v1', 'jsb.prefs.v2', 'jsb.prefs.v3'] as const;

const clearRetiredStorage = (): void => {
  if (typeof window === 'undefined') return;
  try {
    RETIRED_STORAGE_KEYS.forEach(key => window.localStorage.removeItem(key));
  } catch {
    // Storage can be unavailable (private mode, quota); there is nothing to
    // clear then.
  }
};

clearRetiredStorage();

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
