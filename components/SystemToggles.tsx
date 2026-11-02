import React from 'react';
import { interaction } from '../utils/Interaction';
import { announce } from '../utils/liveRegion';
import { preferences, useHapticsAvailable, usePreferences } from '../utils/preferences';

interface SystemTogglesProps {
  className?: string;
}

const toggleClass = (active: boolean): string =>
  `inline-flex h-11 w-11 items-center justify-center border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
    active
      ? 'border-blue-300/40 bg-blue-400/10 text-white'
      : 'border-transparent text-blue-200/55 hover:border-blue-400/25 hover:text-white'
  }`;

/** One 17 px stroke glyph, drawn on the site's 18-unit grid. */
const Glyph: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg
    viewBox="0 0 18 18"
    className="h-[17px] w-[17px]"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

const SoundIcon: React.FC<{ on: boolean }> = ({ on }) => (
  <Glyph>
    <path d="M3.1 7.1h2.5L9 4.5v9l-3.4-2.6H3.1z" />
    {on ? (
      <>
        <path d="M11.4 6.6a3.1 3.1 0 0 1 0 4.8" />
        <path d="M13.2 4.9a5.4 5.4 0 0 1 0 8.2" />
      </>
    ) : (
      <path d="M11.4 7.2 14.8 11M14.8 7.2 11.4 11" />
    )}
  </Glyph>
);

const HapticsIcon: React.FC<{ on: boolean }> = ({ on }) => (
  <Glyph>
    <rect x="6.6" y="3" width="4.8" height="12" rx="0.9" />
    {on && (
      <>
        <path d="M4.4 6.2v5.6M2.7 7.6v2.8" />
        <path d="M13.6 6.2v5.6M15.3 7.6v2.8" />
      </>
    )}
  </Glyph>
);

/**
 * The system controls as two quiet glyphs in the footer. A toggle is only
 * shown when the device can honour it, so haptics never reads "N/A".
 */
const SystemToggles: React.FC<SystemTogglesProps> = ({ className = '' }) => {
  const prefs = usePreferences();
  const hapticsAvailable = useHapticsAvailable();
  const soundAvailable = interaction.soundAvailable;

  const toggleSound = () => {
    if (!soundAvailable) {
      announce('Sound is unavailable in this browser.');
      return;
    }
    const next = !prefs.sound;
    preferences.set({ sound: next });
    announce(next ? 'Sound on' : 'Sound off');
    if (next) interaction.interact('confirm', { source: 'pointer' });
  };

  const toggleHaptics = () => {
    const next = !prefs.haptics;
    preferences.set({ haptics: next });
    announce(next ? 'Haptics on' : 'Haptics off');
    if (next) interaction.interact('cursor', { id: 'settings:haptics', haptic: 'tick' });
  };

  const focusCursor = (id: string) => () => {
    interaction.interact('cursor', { id: `settings:${id}`, source: 'focus' });
  };

  const soundOn = prefs.sound && soundAvailable;

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div role="group" aria-label="System preferences" className="flex items-center gap-1">
        <button
          type="button"
          aria-pressed={soundOn}
          aria-label="Sound"
          title={soundAvailable ? `Sound: ${prefs.sound ? 'on' : 'off'} (M)` : 'Sound: unavailable'}
          onFocus={focusCursor('sound')}
          onClick={toggleSound}
          className={toggleClass(soundOn)}
        >
          <SoundIcon on={soundOn} />
        </button>

        {hapticsAvailable && (
          <button
            type="button"
            aria-pressed={prefs.haptics}
            aria-label="Haptics"
            title={`Haptics: ${prefs.haptics ? 'on' : 'off'}`}
            onFocus={focusCursor('haptics')}
            onClick={toggleHaptics}
            className={toggleClass(prefs.haptics)}
          >
            <HapticsIcon on={prefs.haptics} />
          </button>
        )}
      </div>
    </div>
  );
};

export default SystemToggles;
