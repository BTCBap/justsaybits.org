/**
 * One interaction bus for sound and haptics.
 *
 * Event policy:
 *   cursor  — one quiet tick when the highlighted item changes. No haptic on
 *             hover or focus; an explicit tick only for a deliberate gesture
 *             (swipe or a tab tap).
 *   confirm — rising two-note chime plus one confirm haptic.
 *   back    — lower falling blip plus one tick haptic.
 *   error   — low double pulse plus the error pattern; fires only after the
 *             action has actually failed.
 *   start   — the boot pad, played once after the first user gesture.
 *
 * No sound is scheduled before the AudioContext reports `running`. The first
 * gesture awaits `resume()`; if audio stays unavailable the event is dropped,
 * never queued for later.
 */

import { announce } from './liveRegion';
import { hapticManager, type HapticKind } from './HapticManager';
import { preferences, prefersReducedMotionNow } from './preferences';
import { soundManager, type SoundEvent } from './SoundManager';

export type InteractionEvent = 'cursor' | 'confirm' | 'back' | 'error' | 'start';
export type InteractionSource = 'hover' | 'focus' | 'keyboard' | 'pointer' | 'gesture' | 'system';

export interface InteractOptions {
  /** Stable identity of the newly selected row; used to dedupe cursor ticks. */
  id?: string;
  source?: InteractionSource;
  /** Override the default haptic for this event, or false for none. */
  haptic?: HapticKind | false;
}

const DEFAULT_HAPTIC: Record<InteractionEvent, HapticKind | false> = {
  cursor: false,
  confirm: 'confirm',
  back: 'tick',
  error: 'error',
  start: false,
};

const CURSOR_THROTTLE_MS = 80;
const CURSOR_DEDUPE_MS = 800;
const FOCUS_AFTER_POINTER_MS = 600;

const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element || typeof element.closest !== 'function') return false;
  return !!element.closest('input, textarea, select, [contenteditable="true"]');
};

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

class InteractionBus {
  private lastCursorId: string | null = null;
  private lastCursorAt = -Infinity;
  private lastPointerAt = -Infinity;
  private pending: { event: SoundEvent; at: number } | null = null;
  private unlocking: Promise<boolean> | null = null;
  private cleanup: (() => void) | null = null;
  private startCancelled = false;

  /** Whether this browser exposes the Web Audio API at all. */
  public get soundAvailable(): boolean {
    return soundManager.available;
  }

  public interact(event: InteractionEvent, options: InteractOptions = {}): void {    if (event === 'start') {
      void this.start();
      return;
    }

    if (event === 'cursor') {
      this.cursor(options);
      return;
    }

    const haptic = options.haptic ?? DEFAULT_HAPTIC[event];
    if (haptic) hapticManager.play(haptic);
    this.emitSound(event);
  }

  private cursor(options: InteractOptions): void {
    const at = now();
    if (options.source === 'focus' && at - this.lastPointerAt < FOCUS_AFTER_POINTER_MS) return;
    if (options.id && options.id === this.lastCursorId && at - this.lastCursorAt < CURSOR_DEDUPE_MS) return;
    if (at - this.lastCursorAt < CURSOR_THROTTLE_MS) return;

    this.lastCursorId = options.id ?? null;
    this.lastCursorAt = at;
    if (options.haptic) hapticManager.play(options.haptic);
    this.emitSound('cursor');
  }

  private emitSound(event: SoundEvent): void {
    if (!preferences.get().sound) return;

    if (soundManager.isRunning()) {
      soundManager.play(event, prefersReducedMotionNow());
      return;
    }

    // Keep only the newest event from the current gesture. Anything older is
    // stale by the time a slow resume settles and would fire out of context.
    this.pending = { event, at: Date.now() };
    void this.unlock();
  }

  /** Resume the context from a live user gesture. */
  public async unlock(): Promise<boolean> {
    if (!preferences.get().sound) return false;
    if (!this.unlocking) {
      this.unlocking = soundManager.ensureRunning().then((ok) => {
        this.unlocking = null;
        const pending = this.pending;
        this.pending = null;
        if (
          ok
          && pending
          && Date.now() - pending.at < 300
          && preferences.get().sound
        ) {
          soundManager.play(pending.event, prefersReducedMotionNow());
        }
        return ok;
      });
    }
    return this.unlocking;
  }

  /** Boot pad request; resolves silently when audio is unavailable. */
  public async start(): Promise<void> {
    this.startCancelled = false;
    if (!preferences.get().sound) return;

    const ok = await soundManager.ensureRunning();
    if (!ok || this.startCancelled || !preferences.get().sound) return;

    // The context is running now. Build the pad graph on the next task so
    // constructing its nodes does not share a long task with the power-on
    // frame; the chime still begins well inside the bloom.
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });
    if (this.startCancelled || !preferences.get().sound) return;
    soundManager.playBoot(prefersReducedMotionNow());
  }

  /** Stop the boot pad on unmount and cancel a start that is still resuming. */
  public stopStart(): void {
    this.startCancelled = true;
    soundManager.stopBoot();
  }

  private toggleSound(): void {
    const next = !preferences.get().sound;
    preferences.set({ sound: next });
    announce(next ? 'Sound on' : 'Sound off');
    if (next) this.interact('confirm', { source: 'keyboard' });
  }

  /**
   * Permanent recovery listeners. Resumption is attempted inside the gesture;
   * the listeners are never removed after the first success so a backgrounded
   * or interrupted context can come back.
   */
  public install(): () => void {
    if (this.cleanup) return this.cleanup;

    const onGesture = () => {
      this.lastPointerAt = now();
      void this.unlock();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'm' || event.key === 'M') {
        if (
          !event.repeat
          && !event.metaKey
          && !event.ctrlKey
          && !event.altKey
          && !isEditableTarget(event.target)
        ) {
          event.preventDefault();
          this.toggleSound();
        }
      }
      void this.unlock();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void soundManager.resumeIfPossible();
    };

    const onPageShow = () => {
      void soundManager.resumeIfPossible();
    };

    const unsubscribePreferences = preferences.subscribe(() => {
      const enabled = preferences.get().sound;
      soundManager.setMuted(!enabled);
      if (!enabled) {
        this.pending = null;
        soundManager.stopBoot();
      }
    });

    soundManager.setMuted(!preferences.get().sound);

    window.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
    window.addEventListener('touchend', onGesture, { capture: true, passive: true });
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);

    this.cleanup = () => {
      window.removeEventListener('pointerdown', onGesture, { capture: true });
      window.removeEventListener('touchend', onGesture, { capture: true });
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
      unsubscribePreferences();
      this.pending = null;
      this.unlocking = null;
      this.cleanup = null;
    };

    return this.cleanup;
  }
}

export const interaction = new InteractionBus();
