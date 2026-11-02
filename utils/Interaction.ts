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
 * The first pointer, touch, click or key press primes the AudioContext in the
 * capture phase with a one-sample silent buffer (the iOS unlock) and asks the
 * system for playback audio. A sound from that same gesture waits for
 * `resume()` to settle and then plays; nothing is queued indefinitely. Once
 * the context is running the priming listeners detach, while visibility and
 * page-restore handlers re-resume an interrupted context.
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
const PENDING_MAX_AGE_MS = 1200;
const UNLOCK_EVENTS = ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'] as const;

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
  private unlockCleanup: (() => void) | null = null;
  private startCancelled = false;
  private bootRequested = false;
  private bootPlayed = false;

  /** Whether this browser exposes the Web Audio API at all. */
  public get soundAvailable(): boolean {
    return soundManager.available;
  }

  public interact(event: InteractionEvent, options: InteractOptions = {}): void {
    if (event === 'start') {
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

    // Schedule into an existing context even while it is resuming: the nodes
    // queue and play when the gesture's resume settles. On a phone, resume can
    // take longer than the tap that caused it, so waiting for `running` here
    // was dropping the menu's sound.
    if (soundManager.ready) {
      soundManager.play(event, prefersReducedMotionNow());
      void this.unlock();
      return;
    }

    // No context yet: keep only the newest event from this gesture. Anything
    // older is stale by the time a slow resume settles.
    this.pending = { event, at: Date.now() };
    void this.unlock();
  }

  /** Ask WebKit to keep audio audible with the iPhone silent switch on. */
  private syncAudioSession(): void {
    if (typeof navigator === 'undefined' || !('audioSession' in navigator)) return;
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (!session) return;
    try {
      session.type = preferences.get().sound ? 'playback' : 'auto';
    } catch {
      // Older builds expose the property without allowing a write.
    }
  }

  /** Resume the context from a live user gesture and flush its one sound. */
  public async unlock(): Promise<boolean> {
    if (!preferences.get().sound) return false;
    this.syncAudioSession();
    soundManager.primeFromGesture();
    if (!this.unlocking) {
      this.unlocking = soundManager.ensureRunning().then((ok) => {
        this.unlocking = null;
        const pending = this.pending;
        this.pending = null;
        if (
          ok
          && pending
          && Date.now() - pending.at < PENDING_MAX_AGE_MS
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
    if (this.bootRequested || this.bootPlayed) return;
    this.bootRequested = true;
    this.startCancelled = false;
    if (!preferences.get().sound) {
      this.bootRequested = false;
      return;
    }

    this.syncAudioSession();
    soundManager.primeFromGesture();
    const ok = await soundManager.ensureRunning();
    if (!ok) {
      this.bootRequested = false;
      return;
    }
    if (this.startCancelled || !preferences.get().sound) return;

    // The context is running now. Build the pad graph on the next task so
    // constructing its nodes does not share a long task with the power-on
    // frame; the chime still begins well inside the bloom.
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });
    if (this.startCancelled || !preferences.get().sound) return;
    soundManager.playBoot(prefersReducedMotionNow());
    this.bootPlayed = true;
    this.bootRequested = true;
  }

  /** Stop the boot pad on unmount and cancel a start that is still resuming. */
  public stopStart(): void {
    this.startCancelled = true;
    this.bootPlayed = true;
    this.bootRequested = true;
    soundManager.stopBoot();
  }

  private toggleSound(): void {
    const next = !preferences.get().sound;
    preferences.set({ sound: next });
    announce(next ? 'Sound on' : 'Sound off');
    if (next) {
      this.syncAudioSession();
      this.armUnlock();
      if (!this.bootPlayed) void this.start();
      this.interact('confirm', { source: 'keyboard' });
    }
  }

  /**
   * Prime audio inside the first pointer, touch, click or key gesture. These
   * capture-phase listeners detach once the context runs; the visibility and
   * page-show handlers stay for later interruptions.
   */
  private armUnlock(): void {
    if (this.unlockCleanup || typeof window === 'undefined') return;

    const onGesture = () => {
      this.lastPointerAt = now();
      if (!preferences.get().sound) return;

      this.syncAudioSession();
      soundManager.primeFromGesture();
      if (!this.bootPlayed) void this.start();
      void this.unlock().then((ok) => {
        if (ok) this.disarmUnlock();
      });
    };

    UNLOCK_EVENTS.forEach((type) => {
      window.addEventListener(type, onGesture, { capture: true, passive: true });
    });

    this.unlockCleanup = () => {
      UNLOCK_EVENTS.forEach((type) => {
        window.removeEventListener(type, onGesture, { capture: true });
      });
    };
  }

  private disarmUnlock(): void {
    this.unlockCleanup?.();
    this.unlockCleanup = null;
  }

  public install(): () => void {
    if (this.cleanup) return this.cleanup;

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

    const onRestore = () => {
      this.syncAudioSession();
      void soundManager.resumeIfPossible().then((ok) => {
        if (!ok) this.armUnlock();
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') onRestore();
    };

    const unsubscribePreferences = preferences.subscribe(() => {
      const enabled = preferences.get().sound;
      soundManager.setMuted(!enabled);
      this.syncAudioSession();
      if (enabled) this.armUnlock();
      if (!enabled) {
        this.pending = null;
        soundManager.stopBoot();
      }
    });

    soundManager.setMuted(!preferences.get().sound);
    this.syncAudioSession();
    this.armUnlock();

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pageshow', onRestore);
    document.addEventListener('visibilitychange', onVisibility);

    this.cleanup = () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pageshow', onRestore);
      document.removeEventListener('visibilitychange', onVisibility);
      this.disarmUnlock();
      unsubscribePreferences();
      this.pending = null;
      this.unlocking = null;
      this.cleanup = null;
    };

    return this.cleanup;
  }
}

export const interaction = new InteractionBus();
