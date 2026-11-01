import { canVibrate, isCoarsePointer, preferences, prefersReducedMotionNow } from './preferences';

export type HapticKind = 'tick' | 'confirm' | 'success' | 'error';

const PATTERNS: Record<HapticKind, number | number[]> = {
  // Android quantizes very short pulses; keep the tick above the floor.
  tick: 14,
  confirm: 22,
  success: [16, 45, 16],
  error: [28, 55, 28],
};

const patternLength = (pattern: number | number[]): number =>
  Array.isArray(pattern) ? pattern.reduce((total, value) => total + value, 0) : pattern;

/**
 * Haptics are an enhancement for touch devices only. iOS Safari has no
 * Vibration API, so it is an honest no-op there rather than a silent promise.
 */
class HapticManager {
  private lastKind: HapticKind | null = null;
  private lastAt = 0;
  private lastLength = 0;

  public get available(): boolean {
    return canVibrate() && isCoarsePointer();
  }

  public play(kind: HapticKind): void {
    if (!this.available) return;
    if (!preferences.get().haptics) return;
    if (prefersReducedMotionNow()) return;

    const activation = (navigator as Navigator & {
      userActivation?: { isActive: boolean };
    }).userActivation;
    if (activation && !activation.isActive) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    // One response per action: ignore a duplicate that follows immediately.
    if (this.lastKind === kind && now - this.lastAt < 80) return;
    // A stray tick must not cut off a success or error pattern.
    if (kind === 'tick' && (this.lastKind === 'success' || this.lastKind === 'error') && now - this.lastAt < 500) {
      return;
    }
    // A deliberate new pattern supersedes one that is still running. If the
    // previous pulse has already finished, do not add an extra cancel call.
    if (this.lastKind && this.lastKind !== kind && now - this.lastAt < this.lastLength) {
      try {
        navigator.vibrate(0);
      } catch {
        // Vibration can be blocked by the browser.
      }
    }

    try {
      const pattern = PATTERNS[kind];
      navigator.vibrate(pattern);
      this.lastKind = kind;
      this.lastAt = now;
      this.lastLength = patternLength(pattern);
    } catch {
      // Vibration can be blocked by the browser.
    }
  }

  public cancel(): void {
    if (!this.available) return;
    try {
      navigator.vibrate(0);
    } catch {
      // Vibration can be blocked by the browser.
    }
    this.lastKind = null;
    this.lastAt = 0;
    this.lastLength = 0;
  }
}

export const hapticManager = new HapticManager();
