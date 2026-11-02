/**
 * One interaction bus for haptics.
 *
 * Event policy:
 *   cursor  — no haptic by default; an explicit tick only for a direct tap.
 *   confirm — one confirm haptic.
 *   back    — one tick haptic.
 *   error   — the error pattern; fires only after the action has failed.
 *
 * The site has no interface sounds. Media playback (podcast players, embeds,
 * <audio> and <video>) is owned by its own elements and never routed here.
 */

import { hapticManager, type HapticKind } from './HapticManager';

export type InteractionEvent = 'cursor' | 'confirm' | 'back' | 'error';
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
};

const CURSOR_THROTTLE_MS = 80;
const CURSOR_DEDUPE_MS = 800;
const FOCUS_AFTER_POINTER_MS = 600;
/** One back gesture can reach the bus through the handler and the route. */
const BACK_DEDUPE_MS = 650;
/** Focus returns to the menu a frame or two after a back navigation. */
const BACK_CURSOR_GUARD_MS = 300;

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

class InteractionBus {
  private lastCursorId: string | null = null;
  private lastCursorAt = -Infinity;
  private lastPointerAt = -Infinity;
  private lastBackAt = -Infinity;
  private cursorGuardUntil = -Infinity;
  private cleanup: (() => void) | null = null;

  public interact(event: InteractionEvent, options: InteractOptions = {}): void {
    if (event === 'cursor') {
      this.cursor(options);
      return;
    }

    if (event === 'back') {
      const at = now();
      // A close handler and the route change it causes are one gesture. The
      // first one buzzes; the second is the same back.
      if (at - this.lastBackAt < BACK_DEDUPE_MS) return;
      this.lastBackAt = at;
      // Returning focus to a menu tile must not add a cursor tick to the back.
      this.cursorGuardUntil = at + BACK_CURSOR_GUARD_MS;
    }

    const haptic = options.haptic ?? DEFAULT_HAPTIC[event];
    // A lifecycle or fetch result is not a control action and must stay
    // silent.
    if (haptic && options.source !== 'system') hapticManager.play(haptic);
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
  }

  public install(): () => void {
    if (this.cleanup) return this.cleanup;

    // Focus follows a pointerdown on a button. Keep the timestamp for the
    // whole session so a tap's focus event does not add a cursor tick
    // alongside the action it started.
    const onPointerDown = () => {
      this.lastPointerAt = now();
    };

    window.addEventListener('pointerdown', onPointerDown, true);

    this.cleanup = () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      this.cleanup = null;
    };

    return this.cleanup;
  }
}

export const interaction = new InteractionBus();
