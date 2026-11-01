import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion';

import PS2Background from './components/PS2Background';
import MainMenu from './components/MainMenu';
import BootSequence from './components/BootSequence';
import LiveStatus from './components/LiveStatus';
import NotFoundScreen from './components/NotFoundScreen';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineNotice from './components/OfflineNotice';
import { ScreenSkeleton } from './components/Skeleton';
import { SECTIONS } from './constants';
import { interaction } from './utils/Interaction';
import { hasBootedThisSession, markBootedThisSession } from './utils/bootSession';
import { usePrefersReducedMotion } from './utils/preferences';
import { closeTo, navigate, pathForSection, useRouter, type NavOrigin } from './utils/router';

const ContentScreen = lazy(() => import('./components/ContentScreen'));

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
  // back with the Back button or browser Back. Keyed to the route only: a
  // later arrow-key move must not be pulled back to the card just closed.
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
  }, [route.path, screenOpen, previous]);

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

            <ErrorBoundary>
              <Suspense fallback={<ScreenSkeleton />}>
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
            </ErrorBoundary>
          </div>

          {/* CRT Scanline Effect Overlay — behind the panels, never over text */}
          <div className="crt-overlay pointer-events-none fixed inset-0 z-[5]" />

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
          <OfflineNotice />
        </div>
      </LazyMotion>
    </MotionConfig>
  );
};

export default App;
