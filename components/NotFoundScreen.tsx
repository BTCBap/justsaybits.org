import React, { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { interaction } from '../utils/Interaction';
import { trapTabKey } from '../utils/focus';
import HelpBar from './HelpBar';
import SystemSettings from './SystemSettings';

interface NotFoundScreenProps {
  path: string;
  onHome: () => void;
  /** False while the boot gate owns the screen, so focus is not stolen behind it. */
  focusEnabled?: boolean;
}

/**
 * Branded 404 for an unknown in-app path. It lives in the same shell as every
 * other screen so a mistyped link does not look like a different site.
 */
const NotFoundScreen: React.FC<NotFoundScreenProps> = ({ path, onHome, focusEnabled = true }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!focusEnabled) return;
    headingRef.current?.focus({ preventScroll: true });
  }, [focusEnabled]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (trapTabKey(event, dialogRef.current)) return;
      if (event.key === 'Escape' && !event.repeat) {
        event.preventDefault();
        interaction.interact('back', { source: 'keyboard' });
        onHome();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onHome]);

  return (
    <div
      className="screen-backdrop fixed inset-x-0 top-0 z-50 flex items-stretch justify-center px-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] md:p-12 bg-black/60"
      style={{ height: 'var(--app-height)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notfound-title"
        tabIndex={-1}
        className="screen-panel w-full max-w-3xl h-full min-h-0 flex flex-col border border-blue-500/30 rounded-lg overflow-hidden bg-[#050a14] shadow-[0_0_50px_rgba(0,50,255,0.15)] focus:outline-none"
      >
        <div className="shrink-0 h-16 border-b border-blue-500/30 flex items-center px-6 bg-gradient-to-r from-blue-900/20 to-transparent">
          <h1
            id="notfound-title"
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-bold tracking-widest uppercase text-white ps2-text-shadow focus:outline-none"
          >
            Screen not found
          </h1>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 md:p-10">
          <div className="max-w-xl">
            <p className="mb-3 font-mono text-xs uppercase tracking-widest text-blue-200/80">
              Error 404
            </p>
            <p className="mb-4 text-lg text-blue-100">
              No screen lives at <span className="font-mono text-blue-200">{path}</span>.
            </p>
            <p className="text-sm leading-relaxed text-blue-200/80">
              The link may be mistyped or the file may have moved. The main menu has every screen
              on the system.
            </p>
          </div>
        </div>

        <div className="shrink-0 border-t border-blue-500/30 flex flex-wrap items-center justify-between gap-x-2 md:gap-x-4 gap-y-2 px-4 md:px-6 py-2 bg-black/40">
          <button
            type="button"
            onClick={() => {
              interaction.interact('back', { source: 'pointer' });
              onHome();
            }}
            onFocus={() => interaction.interact('cursor', { id: 'notfound:home', source: 'focus' })}
            className="flex min-h-[44px] items-center space-x-2 text-blue-300 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span className="uppercase tracking-widest font-mono text-xs">Back to Home</span>
          </button>
          <HelpBar
            className="order-3 w-full md:order-2 md:w-auto"
            actions={[{ keys: ['Esc'], label: 'Home', touch: 'Tap Back to return' }]}
            description="Press Escape to return to the main menu."
          />
          <SystemSettings compact />
        </div>
      </div>
    </div>
  );
};

export default NotFoundScreen;
