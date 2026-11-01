declare global {
  interface Window {
    umami?: {
      track: (eventOrPayload: string | Record<string, unknown> | ((props: Record<string, unknown>) => Record<string, unknown>), data?: Record<string, unknown>) => void;
    };
  }
}

import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion';

import PS2Background from './components/PS2Background';
import MainMenu from './components/MainMenu';
import BootSequence from './components/BootSequence';
import LiveStatus from './components/LiveStatus';
import NotFoundScreen from './components/NotFoundScreen';
import { SECTIONS } from './constants';
import { interaction } from './utils/Interaction';
import { hasBootedThisSession, markBootedThisSession } from './utils/bootSession';
import { usePrefersReducedMotion } from './utils/preferences';
import { closeTo, navigate, pathForSection, useRouter, type NavOrigin } from './utils/router';

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
  const { route, previous } = useRouter();
  const activeSection = route.section
    ? SECTIONS.find(section => section.id === route.section) ?? null
    : null;
  const screenOpen = !!activeSection || route.notFound;

  // The menu is composited from the first frame, behind the boot, so there is
  // no layout shift when the overlay clears and no second entrance animation.
  const [bootVisible, setBootVisible] = useState(true);
  const [bootComplete, setBootComplete] = useState(false);
  const [returningVisitor] = useState(() => hasBootedThisSession());
  const [activeMenuIndex, setActiveMenuIndex] = useState(() => {
    const aboutIndex = SECTIONS.findIndex(s => s.id === 'about');
    return aboutIndex >= 0 ? aboutIndex : 0;
  });
  const menuRef = useRef<HTMLDivElement>(null);

  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'auto';
  }, [reducedMotion]);

  // The interaction bus owns audio resumption, recovery, and the M shortcut.
  useEffect(() => interaction.install(), []);

  // Keep the hidden menu's selected card in step with a deep link.
  useEffect(() => {
    if (!activeSection) return;
    const index = SECTIONS.findIndex(section => section.id === activeSection.id);
    if (index >= 0 && index !== activeMenuIndex) setActiveMenuIndex(index);
  }, [activeSection?.id, activeMenuIndex]);

  // Return focus to the card that opened the screen when the visitor comes
  // back with the Back button or browser Back.
  useEffect(() => {
    if (screenOpen || !previous) return;
    if (!previous.section && !previous.notFound) return;
    const id = previous.section ?? SECTIONS[activeMenuIndex]?.id;
    if (!id) return;
    const frame = requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLElement>(`[data-section-id="${id}"]`)
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [route.path, screenOpen, previous, activeMenuIndex]);

  // One pageview per URL, not per rendered component.
  useEffect(() => {
    if (!bootComplete) return;
    window.umami?.track(props => ({ ...props, url: route.path, title: document.title }));
  }, [route.path, bootComplete]);

  // Warm the content chunk once the menu is idle so a first selection does not
  // wait on the network. Nothing is fetched while the boot is running.
  useEffect(() => {
    if (!bootComplete) return;
    const timer = window.setTimeout(() => {
      void import('./components/ContentScreen');
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [bootComplete]);

  const openSection = (id: string, origin?: NavOrigin) => {
    navigate(pathForSection(id), { origin });
  };

  const closeSection = () => {
    closeTo('/');
  };

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
      <LazyMotion features={domAnimation} strict>
        <div className="relative w-full h-full overflow-hidden bg-black text-white selection:bg-blue-500 selection:text-white font-sans">
          
          {/* Background Layer */}
          <PS2Background paused={!bootComplete || screenOpen} reducedMotion={reducedMotion} />

          {/* Main Content Layer */}
          <div
            className="relative z-10 w-full h-full"
            aria-hidden={!bootComplete ? true : undefined}
            inert={!bootComplete || undefined}
          >
            <div
              ref={menuRef}
              className="w-full h-full"
              aria-hidden={screenOpen ? true : undefined}
              inert={screenOpen || undefined}
            >
              <MainMenu
                sections={SECTIONS}
                onSelect={openSection}
                activeIndex={activeMenuIndex}
                onActiveIndexChange={setActiveMenuIndex}
                keyboardEnabled={bootComplete && !screenOpen}
              />
            </div>

            <Suspense fallback={<ContentLoading />}>
              {activeSection ? (
                <ContentScreen
                  key={activeSection.id}
                  section={activeSection}
                  focusEnabled={bootComplete}
                  onBack={closeSection}
                />
              ) : route.notFound ? (
                <NotFoundScreen path={route.path} onHome={closeSection} focusEnabled={bootComplete} />
              ) : null}
            </Suspense>
          </div>

          {/* CRT Scanline Effect Overlay */}
          <div className="crt-overlay pointer-events-none fixed inset-0 z-[100]" />

          {bootVisible && (
            <BootSequence
              short={returningVisitor}
              onReveal={() => setBootComplete(true)}
              onComplete={() => {
                markBootedThisSession();
                setBootComplete(true);
                setBootVisible(false);
              }}
            />
          )}

          <LiveStatus />
        </div>
      </LazyMotion>
    </MotionConfig>
  );
};

export default App;
