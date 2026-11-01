import React from 'react';
import { Volume2, VolumeX, Vibrate, Wind } from 'lucide-react';
import { interaction } from '../utils/Interaction';
import { announce } from '../utils/liveRegion';
import {
  isIOS,
  preferences,
  useHapticsAvailable,
  usePreferences,
  usePrefersReducedMotion,
} from '../utils/preferences';

interface SystemSettingsProps {
  /** Compact controls for the content footer. */
  compact?: boolean;
  /** Show the one-time iOS silent-switch hint (menu help bar only). */
  showHint?: boolean;
  className?: string;
}

const buttonBase =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 border px-2 '
  + 'font-mono uppercase tracking-[0.14em] transition-colors '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 '
  + 'focus-visible:ring-offset-black';

const SystemSettings: React.FC<SystemSettingsProps> = ({ compact = false, showHint = false, className = '' }) => {
  const prefs = usePreferences();
  const reducedMotion = usePrefersReducedMotion();
  const hapticsAvailable = useHapticsAvailable();
  const soundAvailable = interaction.soundAvailable;
  const ios = React.useMemo(() => isIOS(), []);

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
    if (!hapticsAvailable) {
      announce('Haptics are not available on this device.');
      return;
    }
    const next = !prefs.haptics;
    preferences.set({ haptics: next });
    announce(next ? 'Haptics on' : 'Haptics off');
    if (next) interaction.interact('cursor', { id: 'settings:haptics', haptic: 'tick' });
  };

  const toggleMotion = () => {
    const next = prefs.motion === 'on' ? 'auto' : 'on';
    preferences.set({ motion: next });
    announce(next === 'on' ? 'Reduced motion on' : 'Reduced motion follows your system');
    interaction.interact('cursor', { id: 'settings:motion', haptic: 'tick' });
  };

  const soundLabel = !soundAvailable ? 'N/A' : prefs.sound ? 'ON' : 'OFF';
  const hapticLabel = !hapticsAvailable ? 'N/A' : prefs.haptics ? 'ON' : 'OFF';
  const motionLabel = prefs.motion === 'on' ? 'ON' : 'AUTO';

  const focusCursor = (id: string) => () => {
    interaction.interact('cursor', { id: `settings:${id}`, source: 'focus' });
  };

  const showSoundHint = showHint
    && !prefs.soundHintDismissed
    && (prefs.sound || !soundAvailable)
    && (!soundAvailable || ios);

  const dismissHint = () => {
    preferences.set({ soundHintDismissed: true });
    announce('Sound hint dismissed');
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {showSoundHint && (
        <div className="flex items-center justify-center gap-3 border border-blue-500/25 bg-black/50 px-3 text-[12px] text-blue-200/80">
          <span>
            {soundAvailable
              ? 'iPhone: the Ring/Silent switch mutes site audio.'
              : 'Sound is unavailable in this browser.'}
          </span>
          <button
            type="button"
            onClick={dismissHint}
            className="min-h-[44px] px-1 font-mono uppercase tracking-[0.14em] text-blue-300 underline underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Dismiss
          </button>
        </div>
      )}

      <div
        role="group"
        aria-label="System settings"
        className="flex items-center gap-1 border border-blue-500/30 bg-black/60 px-1 py-0.5"
      >
        <button
          type="button"
          aria-pressed={prefs.sound && soundAvailable}
          aria-label={`Sound ${soundLabel}`}
          title={`Sound: ${soundLabel} (M)`}
          onFocus={focusCursor('sound')}
          onClick={toggleSound}
          className={`${buttonBase} ${compact ? 'min-w-[44px]' : 'min-w-[100px]'} text-[12px] ${
            prefs.sound && soundAvailable
              ? 'border-blue-400/60 bg-blue-500/20 text-white'
              : 'border-transparent text-blue-300/70 hover:border-blue-500/40 hover:text-white'
          }`}
        >
          {prefs.sound && soundAvailable
            ? <Volume2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            : <VolumeX className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          <span>{compact ? soundLabel : `Sound ${soundLabel}`}</span>
        </button>

        <button
          type="button"
          aria-pressed={prefs.haptics && hapticsAvailable}
          aria-disabled={!hapticsAvailable}
          aria-label={`Haptics ${hapticLabel}`}
          title={hapticsAvailable ? `Haptics: ${hapticLabel}` : 'Haptics: not available on this device'}
          onFocus={focusCursor('haptics')}
          onClick={toggleHaptics}
          className={`${buttonBase} ${compact ? 'min-w-[44px]' : 'min-w-[100px]'} text-[12px] ${
            !hapticsAvailable
              ? 'border-transparent text-blue-200/75'
              : prefs.haptics
                ? 'border-blue-400/60 bg-blue-500/20 text-white'
                : 'border-transparent text-blue-300/70 hover:border-blue-500/40 hover:text-white'
          }`}
        >
          <Vibrate className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{compact ? hapticLabel : `Haptic ${hapticLabel}`}</span>
        </button>

        <button
          type="button"
          aria-pressed={prefs.motion === 'on'}
          aria-label={`Reduced motion ${motionLabel}`}
          title={`Reduced motion: ${prefs.motion === 'on' ? 'on' : 'follow system'}`}
          onFocus={focusCursor('motion')}
          onClick={toggleMotion}
          className={`${buttonBase} ${compact ? 'min-w-[44px]' : 'min-w-[100px]'} text-[12px] ${
            reducedMotion
              ? 'border-blue-400/60 bg-blue-500/20 text-white'
              : 'border-transparent text-blue-300/70 hover:border-blue-500/40 hover:text-white'
          }`}
        >
          <Wind className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{compact ? motionLabel : `Motion ${motionLabel}`}</span>
        </button>
      </div>
    </div>
  );
};

export default SystemSettings;
