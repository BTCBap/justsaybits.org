import React, { useState, useEffect, useRef, lazy } from 'react';
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion';

import PS2Background from './components/PS2Background';
import MainMenu from './components/MainMenu';
import { BtcFeedProvider } from './components/BtcFeed';
import LiveStatus from './components/LiveStatus';
import NotFoundScreen from './components/NotFoundScreen';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineNotice from './components/OfflineNotice';
import { SoftScreenSuspense } from './components/Skeleton';
import { SECTIONS } from './constants';
import { interaction } from './utils/Interaction';
import { usePrefersReducedMotion } from './utils/preferences';
import { closeTo, navigate, pathForSection, useRouter, type NavOrigin } from './utils/router';

const ContentScreen = lazy(() => import('./components/ContentScreen'));

const App: React.FC = () => {
  const { route, previous, direction } = useRouter();
  const activeSection = route.section
    ? SECTIONS.find(section => section.id === route.section) ?? null
    : null;
  const activeSectionId = activeSection?.id ?? null;
  const screenOpen = !!activeSection || route.notFound;

  // The menu is composited on the first frame: no boot overlay, no inert gate.
  const [activeMenuIndex, setActiveMenuIndex] = useState(() => {
    const aboutIndex = SECTIONS.findIndex(s => s.id === 'about');
    return aboutIndex >= 0 ? aboutIndex : 0;
  });
  const menuRef = useRef<HTMLDivElement>(null);

  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'auto';
  }, [reducedMotion]);

  // The interaction bus owns the back/confirm haptics.
  useEffect(() => interaction.install(), []);

  // Browser Back and the Android back gesture never reach a screen handler.
  // The route change itself confirms them; the close handlers call the same
  // back event first, and the bus dedupes the pair into one tick.
  useEffect(() => {
    if (direction !== 'back' || !previous) return;
    if (!previous.section && !previous.notFound) return;
    interaction.interact('back', { source: 'system' });
  }, [direction, previous, route.path]);

  // Keep the hidden menu's selected card in step with a deep link.
  useEffect(() => {
    if (!activeSectionId) return;
    const index = SECTIONS.findIndex(section => section.id === activeSectionId);
    if (index >= 0 && index !== activeMenuIndex) setActiveMenuIndex(index);
  }, [activeSectionId, activeMenuIndex]);

  // Return focus to the card that opened the screen when the visitor comes
  // back with the Back button or browser Back. Keyed to the route only: a
  // later arrow-key move must not be pulled back to the card just closed.
  useEffect(() => {
    if (screenOpen || !previous) return;
    if (!previous.section && !previous.notFound) return;
    const id = previous.section;
    const frame = requestAnimationFrame(() => {
      const menu = menuRef.current;
      // Prefer the selected tile so arrow keys and Enter both land on it.
      const target = menu?.querySelector<HTMLElement>('[data-section-id][aria-selected="true"]')
        ?? (id ? menu?.querySelector<HTMLElement>(`[data-section-id="${id}"]`) : null);
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [route.path, screenOpen, previous]);

  // Warm the content chunk once the menu is idle so a first selection does not
  // wait on the network.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void import('./components/ContentScreen');
    }, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const openSection = (id: string, origin?: NavOrigin) => {
    navigate(pathForSection(id), { origin });
  };

  const closeSection = () => {
    closeTo('/');
  };

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
      <LazyMotion features={domAnimation} strict>
        {/* Session-scoped BTC feed: survives menu ↔ screen hops so the sparkline
            keeps its tick history instead of reseeding on every return. */}
        <BtcFeedProvider paused={screenOpen}>
          <div className="app-shell relative w-full overflow-hidden bg-[var(--bg)] text-white font-sans">

            {/* Background Layer */}
            <PS2Background paused={screenOpen} reducedMotion={reducedMotion} />

            {/* Main Content Layer */}
            <div className="relative z-10 w-full h-full">
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
                  keyboardEnabled={!screenOpen}
                />
              </div>

              <ErrorBoundary>
                {activeSection ? (
                  <SoftScreenSuspense key={activeSection.id}>
                    <ContentScreen
                      section={activeSection}
                      onBack={closeSection}
                    />
                  </SoftScreenSuspense>
                ) : route.notFound ? (
                  <NotFoundScreen path={route.path} onHome={closeSection} />
                ) : null}
              </ErrorBoundary>
            </div>

            {/* CRT Scanline Effect Overlay — behind the panels, never over text */}
            <div className="crt-overlay pointer-events-none fixed inset-0 z-[5]" />

            <LiveStatus />
            <OfflineNotice />
          </div>
        </BtcFeedProvider>
      </LazyMotion>
    </MotionConfig>
  );
};

export default App;
