import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Section } from '../types';
import { interaction } from '../utils/Interaction';
import { isInteractiveTarget } from '../utils/focus';
import { announce } from '../utils/liveRegion';
import { usePrefersReducedMotion } from '../utils/preferences';
import type { NavOrigin } from '../utils/router';
import HelpBar from './HelpBar';
import SystemToggles from './SystemToggles';

interface MainMenuProps {
  sections: Section[];
  onSelect: (sectionId: string, origin?: NavOrigin) => void;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  /** False while the boot overlay owns the keyboard. */
  keyboardEnabled?: boolean;
}

const DRAG_THRESHOLD = 8;
const MIN_SNAP_DISTANCE = 48;
const MIN_SNAP_VELOCITY = 0.35;
const MOVE_TRANSITION = 'transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 220ms ease';

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastAt: number;
  velocity: number;
  decided: boolean;
  active: boolean;
  moved: boolean;
}

const shortestOffset = (index: number, activeIndex: number, length: number): number => {
  let offset = index - activeIndex;
  if (offset > length / 2) offset -= length;
  if (offset < -length / 2) offset += length;
  return offset;
};

/**
 * The main menu as a PS2 system browser: one calm selected-item panel, a row
 * of system icons below it, a clock, and one help bar. Keyboard input follows
 * the listbox pattern (roving tabindex, arrows, Home/End, Enter/Space); touch
 * drags the row directly and snaps; pointer hover previews and click confirms.
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
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef(new Map<string, HTMLDivElement>());
  const drag = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const suppressTimer = useRef<number | null>(null);

  const activeSection = sections[activeIndex] ?? sections[0];
  const ActiveIcon = activeSection?.icon;

  // Layout follows the viewport instead of scaling a whole subtree, so menu
  // labels stay at their real type size on a phone.
  useEffect(() => {
    const measure = () => {
      const width = window.visualViewport?.width ?? window.innerWidth;
      const height = window.visualViewport?.height ?? window.innerHeight;
      setSpacing(width < 480 ? 132 : width < 768 ? 150 : width < 1100 ? 170 : 190);
      setShort(height < 560);
      setHideClock(height < 500);
    };
    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => () => {
    if (suppressTimer.current !== null) window.clearTimeout(suppressTimer.current);
  }, []);

  const select = useCallback((
    index: number,
    source: 'hover' | 'focus' | 'keyboard' | 'pointer' | 'gesture',
    haptic = false,
  ) => {
    const section = sections[index];
    if (!section) return;
    onActiveIndexChange(index);
    interaction.interact('cursor', {
      id: `menu:${section.id}`,
      source,
      haptic: haptic ? 'tick' : undefined,
    });
    if (source !== 'hover' && source !== 'focus') {
      announce(section.title);
    }
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

  const moveTo = useCallback((index: number, source: 'keyboard' | 'gesture') => {
    const total = sections.length;
    if (!total) return;
    const next = ((index % total) + total) % total;
    select(next, source, source === 'gesture');
    if (source === 'keyboard') {
      optionRefs.current.get(sections[next].id)?.focus({ preventScroll: true });
    }
  }, [sections, select]);

  const moveBy = useCallback((direction: 1 | -1, source: 'keyboard' | 'gesture') => {
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

  const endDrag = (event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    drag.current = null;

    if (!state.active) return;

    const delta = event.clientX - state.startX;
    const shouldCommit = !cancelled
      && (Math.abs(delta) > MIN_SNAP_DISTANCE || Math.abs(state.velocity) > MIN_SNAP_VELOCITY);

    setDragging(false);
    setDragX(0);

    if (state.moved) {
      // A drag that ends on a card must not also open it.
      suppressClick.current = true;
      if (suppressTimer.current !== null) window.clearTimeout(suppressTimer.current);
      suppressTimer.current = window.setTimeout(() => {
        suppressClick.current = false;
      }, 360);
    }

    if (shouldCommit) {
      moveBy(delta < 0 ? 1 : -1, 'gesture');
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    if ((event.target as HTMLElement).closest('button')) return;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastAt: event.timeStamp,
      velocity: 0,
      decided: false,
      active: false,
      moved: false,
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
        stageRef.current?.setPointerCapture(event.pointerId);
      } else if (Math.abs(deltaY) > DRAG_THRESHOLD) {
        drag.current = null;
        return;
      }
    }

    if (state.active) {
      state.moved = state.moved || Math.abs(deltaX) > DRAG_THRESHOLD;
      const limit = spacing * 1.1;
      setDragX(Math.max(-limit, Math.min(limit, deltaX)));
    }
  };

  const handleOptionClick = (index: number) => {
    if (suppressClick.current) return;
    if (index !== activeIndex) {
      select(index, 'pointer');
      return;
    }
    openAt(index, 'pointer');
  };

  const orbitScale = typeof window === 'undefined'
    ? 1
    : (window.visualViewport?.width ?? window.innerWidth) / 1440;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden z-50">

      {/* Quiet orbit line: background texture, not the structure. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[46%] h-[46vh] w-[132vw] -translate-x-1/2 -translate-y-1/2 rotate-6 rounded-[100%] border border-blue-400/10"
        style={{ opacity: Math.min(1, Math.max(0.35, orbitScale)) }}
      />

      {/* System bar */}
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-4 px-5 pt-[max(1rem,env(safe-area-inset-top,0px))] md:px-10 md:pt-6">
        <div className="flex items-center gap-2.5 font-mono text-[12px] uppercase tracking-[0.2em] text-blue-200/80">
          <span aria-hidden="true" className="block h-1.5 w-1.5 bg-cyan-200 shadow-[0_0_8px_rgba(140,220,255,0.9)]" />
          <span>System</span>
          <span aria-hidden="true" className="text-[var(--accent-soft)]">//</span>
          <span className="hidden sm:inline">Main menu</span>
        </div>
        <div className={`text-right font-mono leading-tight ${hideClock ? 'invisible' : ''}`}>
          <Clock compact={short} />
        </div>
      </header>

      <div aria-hidden="true" className="mx-5 mt-3 h-px shrink-0 bg-gradient-to-r from-transparent via-blue-400/30 to-transparent md:mx-10" />

      {/* Selected-item panel */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 py-3 md:px-10 md:py-5">
        {activeSection && (
          <section
            aria-label="Selected section"
            className="menu-panel w-full max-w-3xl"
          >
            <div className="flex items-start gap-4 px-4 py-4 md:gap-6 md:px-7 md:py-6">
              <span
                aria-hidden="true"
                className="menu-panel__orb flex h-12 w-12 shrink-0 items-center justify-center border border-white/50 bg-blue-500/10 text-white shadow-[0_0_26px_rgba(70,130,255,0.35)] md:h-16 md:w-16"
              >
                {ActiveIcon && <ActiveIcon className="h-6 w-6 md:h-8 md:w-8" />}
              </span>

              <div className="min-w-0 flex-1">
                <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-blue-200/75">
                  Section {String(activeIndex + 1).padStart(2, '0')} / {String(sections.length).padStart(2, '0')}
                </p>
                <h2 className="mt-1 text-[28px] font-light uppercase leading-tight tracking-[0.16em] text-white md:text-[36px]">
                  {activeSection.title}
                </h2>
                <button
                  type="button"
                  onClick={() => openAt(activeIndex, 'pointer')}
                  onFocus={() => interaction.interact('cursor', { id: 'menu:open', source: 'focus' })}
                  className="mt-3 inline-flex min-h-[44px] items-center gap-2 border border-blue-300/50 bg-blue-500/10 px-4 font-mono text-[12px] uppercase tracking-[0.18em] text-blue-50 transition-colors hover:border-white hover:bg-blue-500/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  Open
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* System icon row */}
      <div className="relative z-10 shrink-0">
        <div
          ref={stageRef}
          role="listbox"
          aria-label="Main menu sections"
          aria-orientation="horizontal"
          className={`menu-stage relative mx-auto w-full select-none ${short ? 'h-[116px]' : 'h-[148px] md:h-[172px]'}`}
          style={{ touchAction: 'pan-y', perspective: '1000px' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => endDrag(event, false)}
          onPointerCancel={(event) => endDrag(event, true)}
        >
          {sections.map((section, index) => {
            const offset = shortestOffset(index, activeIndex, sections.length);
            const distance = Math.abs(offset);
            const active = offset === 0;
            const Icon = section.icon;
            const transform = `translate(-50%, -50%) translate3d(${offset * spacing + dragX}px, 0, ${-Math.min(distance, 3) * 52}px) rotateY(${Math.max(-12, Math.min(12, offset * -6))}deg) scale(${active ? 1 : 0.84})`;
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
                onClick={() => handleOptionClick(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                onFocus={() => interaction.interact('cursor', { id: `menu:${section.id}`, source: 'focus' })}
                onPointerMove={(event) => {
                  // Hover previews follow real pointer movement. Cards sliding
                  // under a still cursor must not steal a keyboard selection.
                  if (event.pointerType !== 'mouse' || active || drag.current) return;
                  select(index, 'hover');
                }}
                className={`menu-option absolute left-1/2 top-1/2 flex w-[112px] cursor-pointer flex-col items-center md:w-[132px] ${
                  active ? 'menu-option--active' : ''
                }`}
                style={{
                  transform,
                  opacity: active ? 1 : Math.max(0.6, 0.8 - (distance - 1) * 0.09),
                  zIndex: 20 - distance,
                  transition: reducedMotion || dragging
                    ? 'none'
                    : `${MOVE_TRANSITION}, opacity 220ms ease`,
                }}
              >
                <span
                  className={`flex h-[62px] w-[62px] items-center justify-center rounded-full border transition-colors duration-200 md:h-[74px] md:w-[74px] ${
                    active
                      ? 'border-white bg-blue-500/20 text-white shadow-[0_0_30px_rgba(70,140,255,0.55)]'
                      : 'border-blue-300/30 bg-blue-900/20 text-blue-200/70'
                  }`}
                >
                  <Icon className="h-8 w-8 md:h-9 md:w-9" aria-hidden="true" />
                </span>
                <span
                  className={`mt-2.5 text-center text-[12px] uppercase leading-tight tracking-[0.16em] ${
                    active ? 'text-white' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {section.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Edge controls: real 44 px targets on every pointer type. */}
        <button
          type="button"
          aria-label="Previous section"
          onFocus={() => interaction.interact('cursor', { id: 'menu:prev', source: 'focus' })}
          onClick={() => moveBy(-1, 'keyboard')}
          className="absolute bottom-8 left-1 z-30 flex h-11 w-11 items-center justify-center border border-blue-300/35 bg-black/50 text-blue-100 transition-colors hover:border-white hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:left-4 md:h-12 md:w-12"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Next section"
          onFocus={() => interaction.interact('cursor', { id: 'menu:next', source: 'focus' })}
          onClick={() => moveBy(1, 'keyboard')}
          className="absolute bottom-8 right-1 z-30 flex h-11 w-11 items-center justify-center border border-blue-300/35 bg-black/50 text-blue-100 transition-colors hover:border-white hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:right-4 md:h-12 md:w-12"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="flex items-center justify-center gap-3 pb-2 pt-1">
          <span className="font-mono text-[12px] tabular-nums tracking-[0.2em] text-blue-200/75">
            {String(activeIndex + 1).padStart(2, '0')} / {String(sections.length).padStart(2, '0')}
          </span>
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

      {/* One footer: the system toggles and the current screen's controls. */}
      <div
        className="relative z-10 flex shrink-0 flex-col items-center gap-1.5 px-4 text-center"
        style={{ paddingBottom: `calc(12px + env(safe-area-inset-bottom, 0px))` }}
      >
        <SystemToggles showHint />
        <HelpBar
          className="w-full"
          actions={[
            { keys: ['Enter'], label: 'Open', touch: 'Tap to open' },
            { keys: ['←', '→'], label: 'Browse', touch: 'Swipe to browse' },
            { keys: ['M'], label: 'Sound' },
          ]}
          description="Main menu. Left and right arrows browse sections, Home and End jump to the first or last, Enter opens the highlighted section, and M toggles sound. On a touch screen, swipe or use the arrow buttons to browse and tap the highlighted section to open it."
        />
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
