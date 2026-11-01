import React, { useState, useEffect, useCallback, useRef } from 'react';
import { m } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Section } from '../types';
import { interaction } from '../utils/Interaction';
import { isInteractiveTarget } from '../utils/focus';
import type { NavOrigin } from '../utils/router';
import HelpBar from './HelpBar';
import SystemSettings from './SystemSettings';

interface MainMenuProps {
  sections: Section[];
  onSelect: (sectionId: string, origin?: NavOrigin) => void;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  /** False while the boot overlay owns the keyboard. */
  keyboardEnabled?: boolean;
}

const initialFooterBottom = () => {
  const w = window.visualViewport?.width ?? window.innerWidth;
  const h = window.visualViewport?.height ?? window.innerHeight;
  if (h < 500) return 16;
  if (w < 768) return 16;
  if (h < 700 && w >= 768) return 24;
  return 48;
};

const MainMenu: React.FC<MainMenuProps> = ({
  sections,
  onSelect,
  activeIndex,
  onActiveIndexChange,
  keyboardEnabled = true,
}) => {
  // Layout State
  const [spacing, setSpacing] = useState(180);
  const [menuScale, setMenuScale] = useState(1);
  const [menuYOffset, setMenuYOffset] = useState(0);
  // Start at the value the resize pass will use so the footer does not move.
  const [footerBottom, setFooterBottom] = useState(initialFooterBottom);
  const [hideClock, setHideClock] = useState(false);

  // Swipe gesture tracking
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchEndY = useRef<number>(0);
  const MIN_SWIPE_DISTANCE = 50; // minimum distance for a swipe to register

  // Responsive Layout Logic
  useEffect(() => {
    const handleResize = () => {
      const w = window.visualViewport?.width ?? window.innerWidth;
      const h = window.visualViewport?.height ?? window.innerHeight;
      
      // Defaults for Desktop
      let newScale = 1;
      let newSpacing = 500;
      let newYOffset = 0;
      let newFooterBottom = 48;
      let shouldHideClock = false;

      if (w < 768) {
        newSpacing = 140;
        newScale = 0.75;
        newFooterBottom = 16;
      } else if (w < 1024) {
        newSpacing = 300;
      } else if (w < 1400) {
        newSpacing = 400;
      } else {
        newSpacing = 500;
      }

      // Short viewports (landscape phones, small windows) — keep the
      // bottom controls visible and the carousel above them.
      if (h < 500) {
        newScale = 0.55;
        newSpacing = Math.min(newSpacing, 220);
        newYOffset = -25;
        newFooterBottom = 16;
        shouldHideClock = true;
      } else if (h < 700 && w >= 768) {
        newScale = 0.85;
        newFooterBottom = 24;
      }

      setMenuScale(newScale);
      setSpacing(newSpacing);
      setMenuYOffset(newYOffset);
      setFooterBottom(newFooterBottom);
      setHideClock(shouldHideClock);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  const goToAdjacent = useCallback((direction: 1 | -1, source: 'keyboard' | 'gesture' = 'keyboard') => {
    const next = (activeIndex + direction + sections.length) % sections.length;
    onActiveIndexChange(next);
    interaction.interact('cursor', {
      id: `menu:${sections[next].id}`,
      source,
      haptic: 'tick',
    });
  }, [activeIndex, sections, onActiveIndexChange]);

  const cardRefs = useRef(new Map<string, HTMLElement>());

  const originOfCard = (sectionId: string): NavOrigin | undefined => {
    const element = cardRefs.current.get(sectionId);
    if (!element) return undefined;
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!keyboardEnabled || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === 'ArrowRight') {
      goToAdjacent(1);
    } else if (e.key === 'ArrowLeft') {
      goToAdjacent(-1);
    } else if (e.key === 'Enter') {
      // A focused control owns its own Enter (and may have already acted).
      if (e.defaultPrevented || isInteractiveTarget(e.target)) return;
      const section = sections[activeIndex];
      if (!section) return;
      interaction.interact('confirm', { source: 'keyboard' });
      onSelect(section.id, originOfCard(section.id));
    }
  }, [sections, activeIndex, onSelect, goToAdjacent, keyboardEnabled]);

  // Touch handlers for swipe detection
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    const deltaX = touchStartX.current - touchEndX.current;
    const deltaY = touchStartY.current - touchEndY.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Only process horizontal swipes (more horizontal than vertical movement)
    if (absDeltaX > absDeltaY && absDeltaX > MIN_SWIPE_DISTANCE) {
      if (deltaX > 0) {
        // Swipe left - go to next item
        goToAdjacent(1, 'gesture');
      } else {
        // Swipe right - go to previous item
        goToAdjacent(-1, 'gesture');
      }
    }

    // Reset touch positions
    touchStartX.current = 0;
    touchStartY.current = 0;
    touchEndX.current = 0;
    touchEndY.current = 0;
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleItemClick = (index: number) => {
    const section = sections[index];
    if (!section) return;
    interaction.interact('confirm', { source: 'pointer' });
    onActiveIndexChange(index);
    onSelect(section.id, originOfCard(section.id));
  };

  const handleItemHover = (index: number, pointerType: string) => {
    // Touch has no hover; its feedback comes from the gesture and the click.
    if (pointerType !== 'mouse' || index === activeIndex) return;
    onActiveIndexChange(index);
    interaction.interact('cursor', { id: `menu:${sections[index].id}`, source: 'hover' });
  };

  return (
    <div
      className="relative w-full h-full flex items-center justify-center overflow-hidden z-50"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >

      {/* Background Orbit Line */}
      <div
        className="absolute w-[120vw] h-[60vh] border border-blue-500/10 rounded-[100%] rotate-12 blur-sm transform -translate-y-10"
        style={{ transform: `scale(${menuScale}) translateY(${menuYOffset}px) rotate(12deg)` }}
      />

      {/* 3D Carousel Simulation */}
      <div
        className="relative w-full perspective-1000 transition-all duration-300 h-64 origin-center"
        style={{
            transform: `scale(${menuScale}) translateY(${menuYOffset}px)`
        }}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          {sections.map((section, index) => {
            // Calculate relative position based on active index
            let offset = index - activeIndex;
            // Handle wrapping
            if (offset > sections.length / 2) offset -= sections.length;
            if (offset < -sections.length / 2) offset += sections.length;

            const isActive = offset === 0;

            // Use dynamic spacing
            const xOffset = offset * spacing; 
            const zOffset = Math.abs(offset) * -150; 
            const rotateY = offset * 25; 
            const opacity = 1 - Math.abs(offset) * 0.15; 
            
            // Scale logic
            const scale = isActive ? 1.2 : 0.9;

            return (
              <m.div
                key={section.id}
                ref={(element) => {
                  if (element) cardRefs.current.set(section.id, element);
                  else cardRefs.current.delete(section.id);
                }}
                data-section-id={section.id}
                tabIndex={-1}
                className={`absolute top-1/2 left-1/2 cursor-pointer
                  flex flex-col items-center justify-center w-40 h-52
                  transform -translate-x-1/2 -translate-y-1/2 rounded-xl
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-white
                  focus-visible:ring-offset-2 focus-visible:ring-offset-black`}
                initial={false}
                animate={{
                  x: `calc(-50% + ${xOffset}px)`,
                  z: zOffset,
                  rotateY: rotateY,
                  scale: scale,
                  opacity: Math.max(opacity, 0),
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                onClick={() => handleItemClick(index)}
                onPointerEnter={(e) => handleItemHover(index, e.pointerType)}
                style={{
                  zIndex: 100 - Math.abs(offset),
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Orb */}
                <div className={`relative w-24 h-24 mb-6 rounded-full flex items-center justify-center
                  ${isActive 
                    ? 'shadow-[0_0_30px_rgba(50,100,255,0.6)] border-2 border-white' 
                    : 'border border-white/20'
                  }
                  backdrop-blur-md bg-gradient-to-br from-blue-500/30 to-transparent transition-all duration-300`}>
                  
                  <div className="relative z-50">
                    <section.icon 
                      className={`w-10 h-10 transition-colors duration-300 ${
                          isActive 
                          ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]' 
                          : 'text-blue-300/70'
                      }`} 
                    />
                  </div>
                  
                  {/* Internal rotating ring for active */}
                  {isActive && (
                    <m.div 
                      className="absolute inset-0 rounded-full border-t border-r border-transparent border-t-white border-r-white/50"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                    />
                  )}
                </div>

                {/* Label */}
                <div className={`text-center transition-all duration-300 ${isActive ? 'opacity-100 scale-110' : 'opacity-60 scale-90'}`}>
                    <h3 className="text-xl font-bold uppercase tracking-[0.2em] ps2-text-shadow transition-colors duration-300 text-white">
                        {section.title}
                    </h3>
                    {isActive && (
                        <m.div 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-[10px] text-blue-300 mt-2 font-mono uppercase"
                        >
                            Press Enter
                        </m.div>
                    )}
                </div>

                {/* Reflection/Ground shadow */}
                <div className="absolute -bottom-12 w-20 h-4 bg-blue-500/20 blur-xl rounded-full" />
              </m.div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        aria-label="Previous section"
        onFocus={() => interaction.interact('cursor', { id: 'menu:prev', source: 'focus' })}
        onClick={(e) => {
          e.stopPropagation();
          goToAdjacent(-1);
        }}
        className="hidden md:flex absolute left-4 lg:left-10 top-1/2 -translate-y-1/2 z-[110]
          w-14 h-14 items-center justify-center
          rounded-full border border-white/30
          bg-gradient-to-br from-blue-500/30 to-transparent backdrop-blur-md
          text-white/80 hover:text-white hover:border-white
          hover:shadow-[0_0_25px_rgba(50,100,255,0.5)]
          focus-visible:outline-none focus-visible:border-white
          focus-visible:shadow-[0_0_25px_rgba(50,100,255,0.5)]
          transition-all duration-300"
      >
        <ChevronLeft className="w-8 h-8" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        aria-label="Next section"
        onFocus={() => interaction.interact('cursor', { id: 'menu:next', source: 'focus' })}
        onClick={(e) => {
          e.stopPropagation();
          goToAdjacent(1);
        }}
        className="hidden md:flex absolute right-4 lg:right-10 top-1/2 -translate-y-1/2 z-[110]
          w-14 h-14 items-center justify-center
          rounded-full border border-white/30
          bg-gradient-to-br from-blue-500/30 to-transparent backdrop-blur-md
          text-white/80 hover:text-white hover:border-white
          hover:shadow-[0_0_25px_rgba(50,100,255,0.5)]
          focus-visible:outline-none focus-visible:border-white
          focus-visible:shadow-[0_0_25px_rgba(50,100,255,0.5)]
          transition-all duration-300"
      >
        <ChevronRight className="w-8 h-8" strokeWidth={2.25} />
      </button>

      {/* Date/Time */}
      <div
        className={`absolute right-8 text-right font-mono text-blue-200/80 select-none ${hideClock ? 'hidden' : 'block'}`}
        style={{ top: 'calc(2rem + env(safe-area-inset-top, 0px))' }}
      >
        <Clock />
      </div>

      {/* One context-aware help bar, pinned above the home indicator */}
      <div 
        className="absolute inset-x-0 w-full flex flex-col items-center gap-2 px-4 text-center"
        style={{
          bottom: 0,
          paddingBottom: `calc(${footerBottom}px + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        <SystemSettings showHint />
        <HelpBar
          className="w-full"
          actions={[
            { keys: ['←', '→'], label: 'Browse', touch: 'Swipe to browse' },
            { keys: ['Enter'], label: 'Open', touch: 'Tap to open' },
            { keys: ['M'], label: 'Sound' },
          ]}
          description="On a keyboard, left and right arrows browse sections, Enter opens the highlighted section, and M toggles sound. On a touch screen, swipe to browse and tap to open."
        />
      </div>
    </div>
  );
};

// Simple Clock Component
const Clock: React.FC = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const timeString = time.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    });

    const dateString = time.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    return (
        <>
            <div className="text-2xl font-bold tracking-widest ps2-text-shadow">
                {timeString}
            </div>
            <div className="text-sm tracking-widest uppercase opacity-70">
                {dateString}
            </div>
        </>
    );
};

export default MainMenu;