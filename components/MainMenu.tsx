import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Section } from '../types';
import { interaction } from '../utils/Interaction';
import { hapticManager } from '../utils/HapticManager';
import { isInteractiveTarget } from '../utils/focus';
import { usePrefersReducedMotion } from '../utils/preferences';
import type { NavOrigin } from '../utils/router';

interface MainMenuProps {
  sections: Section[];
  onSelect: (sectionId: string, origin?: NavOrigin) => void;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  /** False while an open screen owns the keyboard. */
  keyboardEnabled?: boolean;
}

const DRAG_THRESHOLD = 8;
const MIN_SNAP_DISTANCE = 48;
const MIN_SNAP_VELOCITY = 0.35;
const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
/** Footer controls and page indicators never start a menu drag. */
const isMenuControl = (target: EventTarget | null): boolean =>
  target instanceof Element && !!target.closest('[data-menu-control]');
const MOVE_TRANSITION = 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms cubic-bezier(0.22, 1, 0.36, 1)';
const HOVER_QUERY = '(hover: hover) and (pointer: fine)';
/** Width reserved for each edge chevron: 44 px target + 4 px safe-area inset. */
const EDGE_SLOT = 48;
/** Space to leave between a peeking tile's label and the edge chevron. */
const EDGE_GAP = 24;

interface DragState {
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  lastX: number;
  lastAt: number;
  velocity: number;
  decided: boolean;
  active: boolean;
  moved: boolean;
  /** Where the finger landed: the tap resolves the tile from this target. */
  target: EventTarget | null;
}

const shortestOffset = (index: number, activeIndex: number, length: number): number => {
  let offset = index - activeIndex;
  if (offset > length / 2) offset -= length;
  if (offset < -length / 2) offset += length;
  return offset;
};

/**
 * The main menu as a PS2 system browser: a centred row of large system icons
 * is the whole menu, with the page indicator in the bottom slot. Keyboard input follows the listbox pattern (roving tabindex,
 * arrows, Home/End, Enter/Space); a horizontal swipe anywhere on the screen
 * moves one section and a tap opens immediately; pointer hover previews.
 */
const MainMenu: React.FC<MainMenuProps> = ({
  sections,
  onSelect,
  activeIndex,
  onActiveIndexChange,
  keyboardEnabled = true,
}) => {
  const reducedMotion = usePrefersReducedMotion();
  const [spacing, setSpacing] = useState(132);
  const [short, setShort] = useState(false);
  const [hideClock, setHideClock] = useState(false);
  const [edgeTop, setEdgeTop] = useState<number | null>(null);
  const [edgePruned, setEdgePruned] = useState(true);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef(new Map<string, HTMLDivElement>());
  const drag = useRef<DragState | null>(null);
  /** Pointer type of the gesture that produced the pending click. */
  const lastPointerType = useRef('mouse');
  /** A touch/pen tap already opened a tile and its synthetic click must die. */
  const touchTapActivated = useRef(false);
  /** Wall clock of the swipe that just ended: its tail click is not a tap. */
  const swipeEndedAt = useRef(-Infinity);

  const activeSection = sections[activeIndex] ?? sections[0];

  // Layout follows the viewport instead of scaling a whole subtree, so menu
  // labels stay at their real type size on a phone.
  useEffect(() => {
    const measure = () => {
      const width = window.visualViewport?.width ?? window.innerWidth;
      const height = window.visualViewport?.height ?? window.innerHeight;
      const base = width < 480 ? 148 : width < 768 ? 172 : width < 1100 ? 200 : 228;
      // Keep the two peeking tiles inside the middle band: the widest label
      // half is ~33 px, so the edge chevrons can never sit over a label.
      const widestLabelHalf = 33;
      const edgeLimit = Math.round(width / 2 - EDGE_SLOT - EDGE_GAP - widestLabelHalf);
      const nextSpacing = Math.max(84, Math.min(base, edgeLimit));
      setSpacing(nextSpacing);
      // Far tiles are hidden only when their orb would reach the chevrons.
      setEdgePruned(width / 2 - 2 * nextSpacing - 41 < EDGE_SLOT);
      setShort(height < 560);
      setHideClock(height < 500);
      const stage = stageRef.current;
      if (stage) {
        const rect = stage.getBoundingClientRect();
        // The arrows ride the orb row, which sits just above the tile's
        // vertical centre because the label adds a line underneath.
        setEdgeTop(rect.top + rect.height / 2 - 22);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [short]);

  const select = useCallback((
    index: number,
    source: 'hover' | 'focus' | 'keyboard' | 'pointer' | 'gesture',
    haptic = false,
  ) => {
    const section = sections[index];
    if (!section) return;
    onActiveIndexChange(index);
    if (haptic) hapticManager.play('tick');
    interaction.interact('cursor', {
      id: `menu:${section.id}`,
      source,
    });
  }, [sections, onActiveIndexChange]);

  const originOf = useCallback((index: number): NavOrigin | undefined => {
    const element = optionRefs.current.get(sections[index]?.id ?? '');
    if (!element) return undefined;
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, [sections]);

  const openAt = useCallback((index: number, source: 'pointer' | 'keyboard') => {
    const section = sections[index];
    if (!section) return;
    interaction.interact('confirm', { source });
    onSelect(section.id, originOf(index));
  }, [sections, onSelect, originOf]);

  // One tap selects and opens any tile, including a peeking one and one that
  // is still moving after a swipe.
  const activateTile = useCallback((index: number) => {
    const section = sections[index];
    if (!section) return;
    if (index !== activeIndex) {
      onActiveIndexChange(index);
      hapticManager.play('tick');
    }
    openAt(index, 'pointer');
  }, [activeIndex, sections, onActiveIndexChange, openAt]);

  const moveTo = useCallback((index: number, source: 'keyboard' | 'gesture' | 'pointer') => {
    const total = sections.length;
    if (!total) return;
    const next = ((index % total) + total) % total;
    // A tap and a swipe both land on a new tile, so each one ticks once.
    select(next, source, source === 'pointer' || source === 'gesture');
    if (source === 'keyboard') {
      optionRefs.current.get(sections[next].id)?.focus({ preventScroll: true });
    }
  }, [sections, select]);

  const moveBy = useCallback((direction: 1 | -1, source: 'keyboard' | 'gesture' | 'pointer') => {
    moveTo(activeIndex + direction, source);
  }, [activeIndex, moveTo]);

  // Global arrow/Home/End support for the menu once nothing else owns focus.
  // Enter and Space stay on the focused option, so a button never opens a
  // section by accident.
  useEffect(() => {
    if (!keyboardEnabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (!sections.length) return;
      if (isInteractiveTarget(event.target)) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveBy(1, 'keyboard');
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveBy(-1, 'keyboard');
      } else if (event.key === 'Home') {
        event.preventDefault();
        moveTo(0, 'keyboard');
      } else if (event.key === 'End') {
        event.preventDefault();
        moveTo(sections.length - 1, 'keyboard');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardEnabled, sections.length, moveBy, moveTo]);

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    if (!keyboardEnabled || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveBy(1, 'keyboard');
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveBy(-1, 'keyboard');
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveTo(0, 'keyboard');
    } else if (event.key === 'End') {
      event.preventDefault();
      moveTo(sections.length - 1, 'keyboard');
    } else if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      openAt(index, 'keyboard');
    }
  };

  // --- Direct manipulation -------------------------------------------------

  /**
   * Resolve the tile a tap intended. The pointerdown target is authoritative:
   * a tile can move a long way during the tap, but the visitor aimed at where
   * it was when the finger landed. The pointerup hit test is only a fallback
   * for a pointerdown that landed between tiles in the first place.
   */
  const tileAt = (target: EventTarget | null, x: number, y: number): HTMLElement | null => {
    if (target instanceof Element) {
      const fromDown = target.closest<HTMLElement>('[data-section-id]');
      if (fromDown) return fromDown;
    }
    const atUp = typeof document.elementFromPoint === 'function'
      ? document.elementFromPoint(x, y)
      : null;
    return atUp instanceof Element ? atUp.closest<HTMLElement>('[data-section-id]') : null;
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    drag.current = null;

    if (!state.active) {
      // Touch and pen open on pointerup, in the same gesture. Waiting for the
      // compatibility click lost the first tap on Android.
      const isTouch = state.pointerType === 'touch' || state.pointerType === 'pen';
      if (!cancelled && isTouch) {
        const tile = tileAt(state.target, event.clientX, event.clientY);
        const sectionId = tile?.dataset.sectionId;
        const index = sectionId ? sections.findIndex(section => section.id === sectionId) : -1;
        if (index >= 0) {
          touchTapActivated.current = true;
          activateTile(index);
        }
      }
      return;
    }

    const delta = event.clientX - state.startX;
    const shouldCommit = !cancelled
      && (Math.abs(delta) > MIN_SNAP_DISTANCE || Math.abs(state.velocity) > MIN_SNAP_VELOCITY);

    setDragging(false);
    setDragX(0);

    if (state.moved) {
      // The browser may still deliver a click at the point where this swipe
      // ended. Remember when, so that tail click never opens a tile.
      swipeEndedAt.current = now();
    }

    if (shouldCommit) {
      moveBy(delta < 0 ? 1 : -1, 'gesture');
    }
  };

  /**
   * A tap opens on its own `click`, so there is no compatibility click left
   * for the browser to retarget at the screen or link that just painted under
   * the finger. The click target is checked against the tile the visitor
   * actually touched, and the tail click of a swipe is ignored.
   */
  const handleMenuClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // The footer controls own their clicks.
    if (isMenuControl(event.target)) return;
    // A programmatic click (detail 0, no pointer gesture) is never a tap:
    // the iOS haptic switch and the card links dispatch their own.
    if (event.detail === 0) return;
    // Touch and pen taps already resolved in `endDrag`; only a mouse opens
    // here.
    if (lastPointerType.current !== 'mouse') return;
    // A new gesture resets the mark on pointerdown, so a set mark means this
    // click arrived without one: it is the tail of the swipe that just ended.
    if (swipeEndedAt.current !== -Infinity) return;
    const tile = tileAt(event.target, event.clientX, event.clientY);
    const sectionId = tile?.dataset.sectionId;
    if (!sectionId) return;
    const index = sections.findIndex(section => section.id === sectionId);
    if (index >= 0) activateTile(index);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    lastPointerType.current = event.pointerType;
    // A fresh gesture owns its own click; the previous touch tap is over.
    touchTapActivated.current = false;

    // The footer controls keep their own click path: no drag, no hit testing,
    // no state of their own to settle before they act.
    if (isMenuControl(event.target)) return;

    // Any new gesture starts clean: only the tail click of the swipe that
    // just ended is ignored, never a tap that follows it.
    swipeEndedAt.current = -Infinity;

    if (drag.current) return;
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    // A mouse drag on a control is a miss, not a swipe. Touch may start a
    // swipe on any control as long as the tap itself stays intact.
    if (event.pointerType === 'mouse' && (event.target as HTMLElement).closest('button')) return;
    drag.current = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastAt: event.timeStamp,
      velocity: 0,
      decided: false,
      active: false,
      moved: false,
      target: event.target,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    const elapsed = Math.max(1, event.timeStamp - state.lastAt);
    state.velocity = (event.clientX - state.lastX) / elapsed;
    state.lastX = event.clientX;
    state.lastAt = event.timeStamp;

    if (!state.decided) {
      if (Math.abs(deltaX) > DRAG_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
        state.decided = true;
        state.active = true;
        setDragging(true);
        try {
          rootRef.current?.setPointerCapture(event.pointerId);
        } catch {
          // The pointer may already be gone; the tap guard still applies.
        }
      } else if (Math.abs(deltaY) > DRAG_THRESHOLD) {
        drag.current = null;
        return;
      }
    }

    if (state.active) {
      state.moved = state.moved || Math.abs(deltaX) > DRAG_THRESHOLD;
      if (!reducedMotion) {
        const limit = spacing * 1.1;
        setDragX(Math.max(-limit, Math.min(limit, deltaX)));
      }
    }
  };

  const orbitScale = typeof window === 'undefined'
    ? 1
    : (window.visualViewport?.width ?? window.innerWidth) / 1440;

  // A touch tap opens on pointerup, before the browser's compatibility click.
  // Cancelling that click at touchend keeps it from landing on the screen that
  // just opened underneath the finger. The listener must be non-passive.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onTouchEnd = (event: TouchEvent) => {
      if (!touchTapActivated.current) return;
      touchTapActivated.current = false;
      if (event.cancelable) event.preventDefault();
    };
    root.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => root.removeEventListener('touchend', onTouchEnd);
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative flex h-full w-full flex-col overflow-hidden z-50"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => endDrag(event, false)}
      onPointerCancel={(event) => endDrag(event, true)}
      onClick={handleMenuClick}
    >

      {/* Quiet orbit line: background texture, not the structure. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[46%] h-[46vh] w-[132vw] -translate-x-1/2 -translate-y-1/2 rotate-6 rounded-[100%] border border-blue-400/10"
        style={{ opacity: Math.min(1, Math.max(0.35, orbitScale)) }}
      />

      {/* Clock only: the menu itself is the label. */}
      <header className="relative z-10 flex shrink-0 items-center justify-end gap-4 px-5 pt-[max(1rem,env(safe-area-inset-top,0px))] md:px-10 md:pt-6">
        <div className={`text-right font-mono leading-tight ${hideClock ? 'invisible' : ''}`}>
          <Clock compact={short} />
        </div>
      </header>

      <div aria-hidden="true" className="mx-5 mt-3 h-px shrink-0 bg-gradient-to-r from-transparent via-blue-400/30 to-transparent md:mx-10" />

      {/* The icon row is the menu: centred between the header and the bottom
          controls, with a quiet live announcement for keyboard and swipe. */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center py-4 md:py-6">
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {activeSection
            ? `Section ${String(activeIndex + 1).padStart(2, '0')} of ${String(sections.length).padStart(2, '0')}: ${activeSection.title}`
            : ''}
        </p>

        <div className="menu-stage-wrap w-full">
          <div
            ref={stageRef}
            role="listbox"
            aria-label="Main menu sections"
            aria-orientation="horizontal"
            className={`menu-stage relative mx-auto w-full select-none ${short ? 'h-[150px]' : 'h-[190px] md:h-[248px]'}`}
          >
            {sections.map((section, index) => {
              const offset = shortestOffset(index, activeIndex, sections.length);
              const distance = Math.abs(offset);
              const active = offset === 0;
              const peeking = distance <= 1 || !edgePruned;
              const Icon = section.icon;
              // Flat transforms only: a negative translateZ put the peeking
              // tiles behind the stage plane, where touch hit-testing handed
              // their taps to the parent. Depth comes from scale and opacity.
              const transform = `translate(-50%, -50%) translate3d(${offset * spacing + dragX}px, ${distance * 4}px, 0) scale(${active ? 1 : 0.82})`;
              return (
                <div
                  key={section.id}
                  ref={(element) => {
                    if (element) optionRefs.current.set(section.id, element);
                    else optionRefs.current.delete(section.id);
                  }}
                  id={`menu-option-${section.id}`}
                  data-section-id={section.id}
                  role="option"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onKeyDown={(event) => handleOptionKeyDown(event, index)}
                  onFocus={() => interaction.interact('cursor', { id: `menu:${section.id}`, source: 'focus' })}
                  onPointerMove={(event) => {
                    // Hover previews follow real pointer movement on a device
                    // that can hover. A touch or pen tap must never move the
                    // tile out from under the finger before its click lands.
                    if (
                      event.pointerType !== 'mouse'
                      || event.buttons !== 0
                      || !window.matchMedia(HOVER_QUERY).matches
                      || active
                      || drag.current
                    ) return;
                    select(index, 'hover');
                  }}
                  className={`menu-option absolute left-1/2 top-1/2 flex w-[136px] cursor-pointer flex-col items-center md:w-[176px] ${
                    active ? 'menu-option--active' : ''
                  }`}
                  style={{
                    transform,
                    opacity: active ? 1 : peeking ? Math.max(0.55, 0.78 - (distance - 1) * 0.1) : 0,
                    visibility: peeking ? 'visible' : 'hidden',
                    pointerEvents: peeking ? 'auto' : 'none',
                    zIndex: 20 - distance,
                    transition: reducedMotion || dragging ? 'none' : MOVE_TRANSITION,
                  }}
                >
                  <span
                    className={`flex h-[82px] w-[82px] items-center justify-center rounded-full border transition-colors duration-200 md:h-[104px] md:w-[104px] ${
                      active
                        ? 'border-white bg-blue-500/20 text-white shadow-[0_0_38px_rgba(70,140,255,0.65)]'
                        : 'border-blue-300/30 bg-blue-900/20 text-blue-200/70'
                    }`}
                  >
                    <Icon className="h-9 w-9 md:h-11 md:w-11" aria-hidden="true" />
                  </span>
                  <span
                    className={`mt-3 text-center text-[13px] uppercase leading-tight tracking-[0.18em] md:text-[14px] ${
                      active ? 'font-light text-white' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {section.title}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Small PS2 chevrons at the viewport edges on every device. */}
          <button
            type="button"
            aria-label="Previous section"
            onFocus={() => interaction.interact('cursor', { id: 'menu:prev', source: 'focus' })}
            onClick={() => moveBy(-1, 'pointer')}
            style={{ top: edgeTop ?? undefined }}
            className="menu-edge menu-edge--prev h-11 w-11 items-center justify-center text-blue-200/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Next section"
            onFocus={() => interaction.interact('cursor', { id: 'menu:next', source: 'focus' })}
            onClick={() => moveBy(1, 'pointer')}
            style={{ top: edgeTop ?? undefined }}
            className="menu-edge menu-edge--next h-11 w-11 items-center justify-center text-blue-200/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* The page indicator takes the bottom slot, outside the swipe surface. */}
      <div className="relative z-10 shrink-0" data-menu-control>
        <p className="sr-only">
          Main menu. Left and right arrows browse sections, Home and End jump to the first or last,
          Enter opens the highlighted section. On a touch screen, swipe to browse and tap a
          section to open it.
        </p>

        <div className="menu-counter">
          <span aria-hidden="true" className="flex items-center gap-1.5">
            {sections.map((section, index) => (
              <span
                key={section.id}
                className={`block h-1 w-4 transition-colors duration-200 ${
                  index === activeIndex ? 'bg-white' : 'bg-blue-300/25'
                }`}
              />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
};

const Clock: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = time.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: compact ? undefined : 'short',
  });

  const dateString = time.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="ps2-tnum">
      <div className="text-[20px] font-light tracking-[0.16em] text-blue-50">{timeString}</div>
      <div className="mt-0.5 text-[12px] uppercase tracking-[0.16em] text-[var(--text-muted)]">{dateString}</div>
    </div>
  );
};

export default MainMenu;
