declare global {
  interface Window {
    umami?: {
      track: (eventOrPayload: string | Record<string, unknown> | ((props: Record<string, unknown>) => Record<string, unknown>), data?: Record<string, unknown>) => void;
    };
  }
}

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence, LazyMotion, domAnimation, m } from 'framer-motion';

import PS2Background from './components/PS2Background';
import MainMenu from './components/MainMenu';
import BootSequence from './components/BootSequence';
import { SECTIONS } from './constants';
import { soundManager } from './utils/SoundManager';

const ContentScreen = lazy(() => import('./components/ContentScreen'));

const ContentLoading: React.FC = () => (
  <div
    className="fixed inset-x-0 top-0 z-50 flex items-stretch justify-center px-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] md:p-12 bg-black/60"
    style={{ height: 'var(--app-height)' }}
    role="status"
    aria-live="polite"
  >
    <span className="sr-only">Loading section…</span>
    <div className="w-full max-w-5xl h-full min-h-0 flex flex-col border border-blue-500/30 rounded-lg overflow-hidden bg-[#050a14] shadow-[0_0_50px_rgba(0,50,255,0.15)]">
      <div className="shrink-0 h-16 border-b border-blue-500/30 flex items-center gap-4 px-6 bg-gradient-to-r from-blue-900/20 to-transparent">
        <div className="h-6 w-6 border border-blue-500/40 bg-blue-900/30" />
        <div className="h-5 w-40 bg-blue-900/40 animate-pulse motion-reduce:animate-none" />
      </div>
      <div className="flex-1 min-h-0 p-6 md:p-10 space-y-4">
        {[88, 100, 94, 72, 100, 86].map((width, i) => (
          <div
            key={i}
            className="h-4 bg-blue-900/30 animate-pulse motion-reduce:animate-none"
            style={{ width: `${width}%` }}
          />
        ))}
        <div className="h-40 bg-blue-900/20 animate-pulse motion-reduce:animate-none" />
      </div>
    </div>
  </div>
);

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

  // Warm the content chunk once the menu is idle so a first selection does not
  // wait on the network. Nothing is fetched while the boot is running.
  useEffect(() => {
    if (!bootComplete) return;
    const timer = window.setTimeout(() => {
      void import('./components/ContentScreen');
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [bootComplete]);

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
    <LazyMotion features={domAnimation} strict>
      <div className="relative w-full h-full overflow-hidden bg-black text-white selection:bg-blue-500 selection:text-white font-sans">
        
        <AnimatePresence mode='wait'>
          {!bootComplete && (
            <m.div 
               key="boot"
               className="absolute inset-0 z-[200]"
               exit={{ opacity: 0, transition: { duration: 1 } }}
            >
              <BootSequence onComplete={() => setBootComplete(true)} />
            </m.div>
          )}
        </AnimatePresence>

        {/* Background Layer */}
        <PS2Background paused={!bootComplete || !!activeSection} />

        {/* Main Content Layer */}
        <div className="relative z-10 w-full h-full">
          <Suspense fallback={<ContentLoading />}>
            <AnimatePresence mode='wait'>
              {bootComplete && activeSection ? (
                <ContentScreen 
                  key="content"
                  section={activeSection} 
                  onBack={() => setActiveSectionId(null)} 
                />
              ) : bootComplete ? (
                <m.div 
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
                </m.div>
              ) : null}
            </AnimatePresence>
          </Suspense>
        </div>

        {/* CRT Scanline Effect Overlay */}
        <div className="crt-overlay pointer-events-none fixed inset-0 z-[100]" />
        
      </div>
    </LazyMotion>
  );
};

export default App;
