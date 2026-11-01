import React from 'react';
import { useMediaQuery } from '../utils/preferences';

export interface HelpAction {
  /** Keycaps shown on keyboard devices. */
  keys: string[];
  label: string;
  /** Touch wording; omit to hide the action on touch. */
  touch?: string;
}

interface HelpBarProps {
  actions: HelpAction[];
  /**
   * The same instructions in a sentence for assistive technology. The visible
   * keycaps are decorative, so this is the only copy a screen reader hears.
   */
  description: string;
  className?: string;
}

/**
 * One context-aware help bar: real keycaps on keyboard devices and a short
 * touch legend on coarse pointers. Only the current screen's actions appear.
 */
const HelpBar: React.FC<HelpBarProps> = ({ actions, description, className = '' }) => {
  const touch = useMediaQuery('(pointer: coarse)');
  const touchActions = actions.filter(action => action.touch);

  return (
    <>
      <p className="sr-only">{description}</p>
      <div
        aria-hidden="true"
        className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-sans text-[12px] uppercase tracking-[0.14em] text-[var(--text-secondary)] ${className}`}
      >
        {touch ? (
          <span className="text-center leading-relaxed">
            {touchActions.map(action => action.touch).join(' · ')}
          </span>
        ) : (
          actions.map(action => (
            <span key={`${action.label}:${action.keys.join('')}`} className="flex items-center gap-1.5">
              {action.keys.map(key => (
                <kbd
                  key={key}
                  className="min-w-[1.5rem] rounded-sm border border-blue-300/50 bg-black/40 px-1.5 py-0.5 text-center font-mono text-[12px] leading-tight text-blue-50"
                >
                  {key}
                </kbd>
              ))}
              <span className="leading-none">{action.label}</span>
            </span>
          ))
        )}
      </div>
    </>
  );
};

export default HelpBar;
