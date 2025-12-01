/**
 * HapticManager
 * Provides haptic feedback for mobile devices using the Vibration API
 */

type HapticPattern = number | number[];

class HapticManager {
  private isSupported: boolean;

  constructor() {
    // Check if the Vibration API is supported
    this.isSupported = 'vibrate' in navigator;
  }

  /**
   * Trigger a vibration pattern
   * @param pattern - Single duration (ms) or array of [vibrate, pause, vibrate, ...]
   */
  private vibrate(pattern: HapticPattern): void {
    if (!this.isSupported) return;

    try {
      navigator.vibrate(pattern);
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  }

  /**
   * Light tap - for hover/navigation
   */
  public light(): void {
    this.vibrate(10);
  }

  /**
   * Medium tap - for selections and button presses
   */
  public medium(): void {
    this.vibrate(20);
  }

  /**
   * Strong tap - for important actions or confirmations
   */
  public strong(): void {
    this.vibrate(40);
  }

  /**
   * Success pattern - two quick taps
   */
  public success(): void {
    this.vibrate([15, 50, 15]);
  }

  /**
   * Error pattern - three short pulses
   */
  public error(): void {
    this.vibrate([30, 50, 30, 50, 30]);
  }

  /**
   * Navigation swipe - subtle feedback for carousel navigation
   */
  public swipe(): void {
    this.vibrate(15);
  }

  /**
   * Cancel all ongoing vibrations
   */
  public cancel(): void {
    if (!this.isSupported) return;
    navigator.vibrate(0);
  }

  /**
   * Check if haptic feedback is available
   */
  public get available(): boolean {
    return this.isSupported;
  }
}

// Export singleton instance
export const hapticManager = new HapticManager();
