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
 *   start   — the boot pad plus a light tick, scheduled in the first gesture.
 *
 * The first pointer, touch, click or key press primes the AudioContext in the
 * capture phase with a one-sample silent buffer (the iOS unlock), schedules
 * the boot pad into it and resumes inside that gesture. The site never writes
 * `navigator.audioSession`, so it keeps the browser's mixing behaviour and
 * cannot interrupt or duck audio from other apps. Once the context is running
 * the priming listeners detach. Hiding the page fades the output and stops
 * every scheduled voice; it never suspends the context, so returning never
 * renegotiates the audio session. Only the next gesture inside the page can
 * start audio again.
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
/** One back gesture can reach the sound through the handler and the route. */
const BACK_DEDUPE_MS = 650;
/** Focus returns to the menu a frame or two after a back navigation. */
const BACK_CURSOR_GUARD_MS = 300;
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
  private lastBackAt = -Infinity;
  private cursorGuardUntil = -Infinity;
  private pending: { event: SoundEvent; at: number } | null = null;
  private unlocking: Promise<boolean> | null = null;
  private cleanup: (() => void) | null = null;
  private unlockCleanup: (() => void) | null = null;
  private startCancelled = false;
  private bootRequested = false;
  private bootPlayed = false;
  private bootSounded = false;
  private arrivalHandled = false;

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

    if (event === 'back') {
      const at = now();
      // A close handler and the route change it causes are one gesture. The
      // first one sounds; the second is the same back.
      if (at - this.lastBackAt < BACK_DEDUPE_MS) return;
      this.lastBackAt = at;
      // Returning focus to a menu tile must not add a cursor tick to the back.
      this.cursorGuardUntil = at + BACK_CURSOR_GUARD_MS;
    }

    const haptic = options.haptic ?? DEFAULT_HAPTIC[event];
    if (haptic) hapticManager.play(haptic);
    this.emitSound(event);
  }

  private cursor(options: InteractOptions): void {
    const at = now();
    if (at < this.cursorGuardUntil) return;
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

  /** Resume the context from a live user gesture and flush its one sound. */
  public async unlock(): Promise<boolean> {
    if (!preferences.get().sound) return false;
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

  /**
   * First-gesture boot: schedule the pad into the context synchronously, so
   * the same touch that unlocks audio also sounds it, then resume alongside.
   * A light haptic fires in the same activation.
   */
  public async start(): Promise<void> {
    // The short intro can finish before any gesture and cancel a pending
    // start. If it never actually sounded, the first arrival still gets it.
    if (!this.bootSounded) {
      this.bootPlayed = false;
      this.bootRequested = false;
      this.startCancelled = false;
    }
    if (this.bootRequested || this.bootPlayed) return;
    this.bootRequested = true;
    this.startCancelled = false;

    hapticManager.play('tick', true);

    if (!preferences.get().sound) {
      this.bootRequested = false;
      return;
    }

    soundManager.primeFromGesture();

    // A suspended context still queues nodes; resume() settles in this same
    // gesture and the pad begins from its first sample.
    if (soundManager.ready) {
      soundManager.playBoot(prefersReducedMotionNow());
      this.bootPlayed = true;
      this.bootSounded = true;
    }

    const ok = await soundManager.ensureRunning();
    if (!ok) {
      if (this.bootPlayed) {
        soundManager.stopBoot();
        this.bootPlayed = false;
        this.bootSounded = false;
      }
      this.bootRequested = false;
      return;
    }
    if (this.startCancelled || !preferences.get().sound) return;
    // A gesture that began before the tab was backgrounded must not sound
    // after the resume settles.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.bootRequested = false;
      return;
    }
    if (!this.bootPlayed) {
      soundManager.playBoot(prefersReducedMotionNow());
      this.bootPlayed = true;
      this.bootSounded = true;
    }
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

      // The very first gesture gets the boot pad and a light haptic, even on
      // the intro screen, before any second interaction is needed.
      if (!this.arrivalHandled) {
        this.arrivalHandled = true;
        void this.start();
      }

      if (!preferences.get().sound) return;

      soundManager.primeFromGesture();
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

    // Focus follows a pointerdown on a button. Keep the timestamp for the
    // whole session: the one-shot unlock listeners detach after the first
    // gesture, and a stale timestamp let a tap's focus event play a cursor
    // tick alongside the action it started.
    const onPointerDown = () => {
      this.lastPointerAt = now();
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

    // Only hiding silences audio. Focus, pageshow and a return to visible all
    // fire around the first tap on some browsers; quenching there cut the
    // boot tone at full gain and clicked. The next explicit gesture resumes.
    const suspendAudio = () => {
      this.pending = null;
      soundManager.quiesce();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') suspendAudio();
    };

    const onPageHide = () => suspendAudio();

    const unsubscribePreferences = preferences.subscribe(() => {
      const enabled = preferences.get().sound;
      soundManager.setMuted(!enabled);
      if (enabled) this.armUnlock();
      if (!enabled) {
        this.pending = null;
        soundManager.stopBoot();
      }
    });

    soundManager.setMuted(!preferences.get().sound);
    this.armUnlock();

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);

    this.cleanup = () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pagehide', onPageHide);
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
