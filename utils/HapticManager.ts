import { canUseIOSHapticFallback, canVibrate, isCoarsePointer } from './preferences';

export type HapticKind = 'tick' | 'confirm' | 'success' | 'error';

const PATTERNS: Record<HapticKind, number | number[]> = {
  // Android quantizes short pulses, so keep every pulse at or above 18 ms.
  tick: 18,
  confirm: 35,
  success: [20, 45, 20],
  error: [30, 55, 30],
};

/**
 * Haptics are an enhancement for touch devices only. Android and other
 * Vibration API browsers get short pulses; iOS Safari has no Vibration API, so
 * it gets the switch-toggle system haptic instead. Reduced motion is visual
 * only and does not mute touch feedback.
 */
class HapticManager {
  private lastKind: HapticKind | null = null;
  private lastAt = 0;
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
      label.dataset.hapticSwitch = 'true';
      label.style.cssText = 'display:block;position:fixed;top:0;left:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      input.setAttribute('aria-hidden', 'true');
      input.style.pointerEvents = 'none';
      // The switch exists only to trigger the system haptic. It must never
      // keep focus, reach the menu's click guard, or act as a real control.
      label.addEventListener('click', (event) => event.stopPropagation());
      input.addEventListener('click', (event) => event.stopPropagation());
      input.addEventListener('focus', () => {
        input.blur();
      });
      label.appendChild(input);
      document.body.appendChild(label);
      this.iosSwitch = label;
    }
    const input = this.iosSwitch.querySelector('input');
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    this.iosSwitch.click();
    if (input && document.activeElement === input) {
      if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
      else input.blur();
    }
  }

  /**
   * `play` runs only from a control's own event handler. The browser must
   * still report a live user gesture: that is what keeps a lifecycle event
   * (load, pageshow, visibilitychange, focus, pagehide) from ever buzzing.
   */
  public play(kind: HapticKind): void {
    if (!this.available) return;
    // A hidden page never buzzes: a background pulse is felt as a click and
    // is not the result of anything the visitor did on screen.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    const vibrates = canVibrate();
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
    // A deliberate new pattern supersedes one that is still running. Never
    // send vibrate(0) first: Android drops the new pulse when it is cancelled
    // in the same gesture.
    try {
      if (vibrates) {
        navigator.vibrate(PATTERNS[kind]);
      } else {
        this.playIOSSwitch();
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
  }
}

export const hapticManager = new HapticManager();
