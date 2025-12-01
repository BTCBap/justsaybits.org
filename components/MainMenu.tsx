import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Section } from '../types';
import { soundManager } from '../utils/SoundManager';

interface MainMenuProps {
  sections: Section[];
  onSelect: (sectionId: string) => void;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ sections, onSelect, activeIndex, onActiveIndexChange }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Layout State
  const [spacing, setSpacing] = useState(180);
  const [menuScale, setMenuScale] = useState(1);
  const [menuYOffset, setMenuYOffset] = useState(0);
  const [footerBottom, setFooterBottom] = useState(48); // px (starts at bottom-12 = 3rem = 48px)
  const [hideClock, setHideClock] = useState(false);

  // Responsive Layout Logic
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      // Defaults for Desktop
      let newScale = 1;
      let newSpacing = 500;
      let newYOffset = 0;
      let newFooterBottom = 48;
      let shouldHideClock = false;

      if (w < 768) {
        // --- MOBILE ---
        if (h < 500 && w > h) {
          // Landscape Mobile (Short height)
          // Aggressive scaling to fit vertically without overlapping footer
          newScale = 0.55; 
          newSpacing = 220; 
          newYOffset = -25; // Push menu up
          newFooterBottom = 16; // Push footer down (bottom-4)
          shouldHideClock = true;
        } else {
          // Portrait Mobile (Narrow width)
          // Moderate scaling to prevent horizontal clipping
          newScale = 0.75; 
          newSpacing = 140; // Tighter spacing
          newYOffset = 0;
          newFooterBottom = 48;
        }
      } else {
        // --- DESKTOP / TABLET ---
        // Width based spacing
        if (w < 1024) {
           newSpacing = 300;
        } else if (w < 1400) {
           newSpacing = 400;
        } else {
           newSpacing = 500;
        }

        // Height based scaling (Short laptops/windows)
        if (h < 700) {
            newScale = 0.85;
            newFooterBottom = 24;
        }
      }

      setMenuScale(newScale);
      setSpacing(newSpacing);
      setMenuYOffset(newYOffset);
      setFooterBottom(newFooterBottom);
      setHideClock(shouldHideClock);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      onActiveIndexChange((activeIndex + 1) % sections.length);
      soundManager.playHover();
    } else if (e.key === 'ArrowLeft') {
      onActiveIndexChange((activeIndex - 1 + sections.length) % sections.length);
      soundManager.playHover();
    } else if (e.key === 'Enter') {
      soundManager.playSelect();
      onSelect(sections[activeIndex].id);
    }
  }, [sections, activeIndex, onSelect, onActiveIndexChange]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleItemClick = (index: number) => {
    soundManager.playSelect();
    onActiveIndexChange(index);
    onSelect(sections[index].id);
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden z-50">
      
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
            const isHovered = index === hoveredIndex;

            // Use dynamic spacing
            const xOffset = offset * spacing; 
            const zOffset = Math.abs(offset) * -150; 
            const rotateY = offset * 25; 
            const opacity = 1 - Math.abs(offset) * 0.15; 
            
            // Scale logic
            let scale = isActive ? 1.2 : 0.9;
            if (isHovered) {
                scale *= 1.15; 
            }

            return (
              <motion.div
                key={section.id}
                className={`absolute top-1/2 left-1/2 cursor-pointer
                  flex flex-col items-center justify-center w-40 h-52
                  transform -translate-x-1/2 -translate-y-1/2`}
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
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  zIndex: 100 - Math.abs(offset),
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Orb */}
                <div className={`relative w-24 h-24 mb-6 rounded-full flex items-center justify-center
                  ${isActive 
                    ? 'shadow-[0_0_30px_rgba(50,100,255,0.6)] border-2 border-white' 
                    : (isHovered 
                        ? 'border-2 border-white/80 bg-white/10 shadow-[0_0_25px_rgba(255,255,255,0.3)]' 
                        : 'border border-white/20'
                      )
                  }
                  backdrop-blur-md bg-gradient-to-br from-blue-500/30 to-transparent transition-all duration-300`}>
                  
                  <motion.div
                    className="relative z-50"
                    animate={isHovered ? { 
                      rotate: [0, -8, 8, 0],
                      scale: [1, 1.05, 1]
                    } : { 
                      rotate: 0,
                      scale: 1 
                    }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity, 
                      ease: "easeInOut" 
                    }}
                  >
                    <section.icon 
                      className={`w-10 h-10 transition-colors duration-300 ${
                          isActive 
                          ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]' 
                          : (isHovered ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]' : 'text-blue-300/70')
                      }`} 
                    />
                  </motion.div>
                  
                  {/* Internal rotating ring for active */}
                  {isActive && (
                    <motion.div 
                      className="absolute inset-0 rounded-full border-t border-r border-transparent border-t-white border-r-white/50"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                    />
                  )}
                </div>

                {/* Label */}
                <div className={`text-center transition-all duration-300 ${isActive || isHovered ? 'opacity-100 scale-110' : 'opacity-60 scale-90'}`}>
                    <h3 className={`text-xl font-bold uppercase tracking-[0.2em] ps2-text-shadow transition-colors duration-300 ${isHovered && !isActive ? 'text-white' : 'text-white'}`}>
                        {section.title}
                    </h3>
                    {isActive && (
                        <motion.div 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-[10px] text-blue-300 mt-2 font-mono uppercase"
                        >
                            Press Enter
                        </motion.div>
                    )}
                </div>

                {/* Reflection/Ground shadow */}
                <div className="absolute -bottom-12 w-20 h-4 bg-blue-500/20 blur-xl rounded-full" />
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Date/Time */}
      <div className={`absolute top-8 right-8 text-right font-mono text-blue-200/80 select-none ${hideClock ? 'hidden' : 'block'}`}>
        <Clock />
      </div>

      {/* Helper Text - Dynamic Bottom Position */}
      <div 
        className="absolute w-full text-center transition-all duration-300"
        style={{ bottom: `${footerBottom}px` }}
      >
        <div className="flex items-center justify-center space-x-8 text-sm text-blue-400/60 font-mono uppercase tracking-widest">
            <span className="flex items-center">
                <span className="border border-blue-400/60 px-2 py-0.5 mr-2 text-[10px] rounded-sm font-bold">ENTER</span> 
                Select
            </span>
            <span className="flex items-center">
                <span className="flex space-x-1 mr-2">
                     <span className="w-5 h-5 border border-blue-400/60 flex items-center justify-center text-[10px] rounded-sm font-bold">←</span>
                     <span className="w-5 h-5 border border-blue-400/60 flex items-center justify-center text-[10px] rounded-sm font-bold">→</span>
                </span>
                Navigate
            </span>
        </div>
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