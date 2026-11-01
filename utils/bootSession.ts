/**
 * The full boot is a once-per-session event. A reload in the same tab gets a
 * short fade instead, which keeps the occasion without making the visitor sit
 * through the sequence again.
 */
const BOOT_SESSION_KEY = 'jsb.boot.v1';

export const hasBootedThisSession = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(BOOT_SESSION_KEY) === '1';
  } catch {
    return false;
  }
};

export const markBootedThisSession = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(BOOT_SESSION_KEY, '1');
  } catch {
    // Private mode or a disabled store: the boot simply runs again.
  }
};
