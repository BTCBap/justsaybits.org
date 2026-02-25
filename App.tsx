declare global {
  interface Window {
    umami?: {
      track: (eventOrPayload: string | Record<string, unknown> | ((props: Record<string, unknown>) => Record<string, unknown>), data?: Record<string, unknown>) => void;
    };
  }
}

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import PS2Background from './components/PS2Background';
import MainMenu from './components/MainMenu';
import ContentScreen from './components/ContentScreen';
import BootSequence from './components/BootSequence';
import { SECTIONS } from './constants';
import { soundManager } from './utils/SoundManager';

const App: React.FC = () => {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [bootComplete, setBootComplete] = useState(false);
  const [activeMenuIndex, setActiveMenuIndex] = useState(() => {
    const aboutIndex = SECTIONS.findIndex(s => s.id === 'about');
    return aboutIndex >= 0 ? aboutIndex : 0;
  });

  const activeSection = SECTIONS.find(s => s.id === activeSectionId);

  // Track virtual pageviews on section navigation
  useEffect(() => {
    if (!bootComplete) return;
    const url = activeSectionId ? `/${activeSectionId}` : '/';
    const title = activeSectionId
      ? (SECTIONS.find(s => s.id === activeSectionId)?.title ?? activeSectionId)
      : 'Home';
    window.umami?.track(props => ({ ...props, url, title }));
  }, [activeSectionId, bootComplete]);

  // Resume AudioContext on first interaction
  useEffect(() => {
    const handleInteraction = () => {
      soundManager.resume();
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-white selection:bg-blue-500 selection:text-white font-sans">
      
      <AnimatePresence mode='wait'>
        {!bootComplete && (
          <motion.div 
             key="boot"
             className="absolute inset-0 z-[200]"
             exit={{ opacity: 0, transition: { duration: 1 } }}
          >
            <BootSequence onComplete={() => setBootComplete(true)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Layer */}
      <PS2Background />

      {/* Main Content Layer */}
      <div className="relative z-10 w-full h-full">
        <AnimatePresence mode='wait'>
          {bootComplete && activeSection ? (
            <ContentScreen 
              key="content"
              section={activeSection} 
              onBack={() => setActiveSectionId(null)} 
            />
          ) : bootComplete ? (
            <motion.div 
              key="menu"
              className="w-full h-full"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.5, filter: "blur(10px)", transition: { duration: 0.5 } }}
              transition={{ duration: 0.8 }}
            >
              <MainMenu
                sections={SECTIONS}
                onSelect={(id) => setActiveSectionId(id)}
                activeIndex={activeMenuIndex}
                onActiveIndexChange={setActiveMenuIndex}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* CRT Scanline Effect Overlay */}
      <div className="pointer-events-none fixed inset-0 z-[100] opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      
    </div>
  );
};

export default App;
