import { canUseIOSHapticFallback, canVibrate, isCoarsePointer, preferences } from './preferences';

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
 * Haptics are an enhancement for touch devices only. Android and other
 * Vibration API browsers get short pulses; iOS Safari has no Vibration API, so
 * it gets the switch-toggle system haptic instead. Reduced motion is visual
 * only and does not mute touch feedback.
 */
class HapticManager {
  private lastKind: HapticKind | null = null;
  private lastAt = 0;
  private lastLength = 0;
  private iosSwitch: HTMLLabelElement | null = null;

  public get available(): boolean {
    return (canVibrate() && isCoarsePointer()) || canUseIOSHapticFallback();
  }

  /**
   * Toggling a `<input switch>` inside a label from a live gesture plays the
   * iOS system haptic. The control is invisible, out of the tab order and
   * hidden from assistive technology.
   */
  private playIOSSwitch(): void {
    if (typeof document === 'undefined') return;
    if (!this.iosSwitch || !this.iosSwitch.isConnected) {
      const label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.cssText = 'display:block;position:fixed;top:0;left:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      input.setAttribute('aria-hidden', 'true');
      label.appendChild(input);
      document.body.appendChild(label);
      this.iosSwitch = label;
    }
    this.iosSwitch.click();
  }

  public play(kind: HapticKind): void {
    if (!this.available) return;
    if (!preferences.get().haptics) return;

    const vibrates = canVibrate();
    const activation = (navigator as Navigator & {
      userActivation?: { isActive: boolean };
    }).userActivation;
    if (vibrates && activation && !activation.isActive) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    // One response per action: ignore a duplicate that follows immediately.
    if (this.lastKind === kind && now - this.lastAt < 80) return;
    // A stray tick must not cut off a success or error pattern.
    if (kind === 'tick' && (this.lastKind === 'success' || this.lastKind === 'error') && now - this.lastAt < 500) {
      return;
    }
    // A deliberate new pattern supersedes one that is still running. If the
    // previous pulse has already finished, do not add an extra cancel call.
    if (vibrates && this.lastKind && this.lastKind !== kind && now - this.lastAt < this.lastLength) {
      try {
        navigator.vibrate(0);
      } catch {
        // Vibration can be blocked by the browser.
      }
    }

    try {
      if (vibrates) {
        const pattern = PATTERNS[kind];
        navigator.vibrate(pattern);
        this.lastLength = patternLength(pattern);
      } else {
        this.playIOSSwitch();
        this.lastLength = patternLength(PATTERNS[kind]);
      }
      this.lastKind = kind;
      this.lastAt = now;
    } catch {
      // Haptics can be blocked by the browser.
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
