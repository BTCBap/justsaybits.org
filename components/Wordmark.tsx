import React from 'react';

interface WordmarkProps {
  /** Hide the mark from assistive tech when a labelled heading is present. */
  decorative?: boolean;
  className?: string;
}

/**
 * Original justsaybits identity: three ascending "bits" inside a thin frame,
 * with a Bitcoin mark. The same lockup is used on the power-on gate and the
 * boot payoff so the two screens read as one system.
 */
const Wordmark: React.FC<WordmarkProps> = ({ decorative = false, className = '' }) => (
  <span
    className={`boot-wordmark ${className}`}
    aria-hidden={decorative ? 'true' : undefined}
  >
    <svg
      className="boot-wordmark__mark"
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={decorative ? undefined : 'justsaybits monogram'}
      focusable="false"
    >
      <rect x="7.5" y="7.5" width="49" height="49" rx="5" stroke="currentColor" strokeOpacity="0.5" />
      <rect x="16" y="36" width="6" height="14" fill="currentColor" fillOpacity="0.55" />
      <rect x="28" y="26" width="6" height="24" fill="currentColor" fillOpacity="0.78" />
      <rect x="40" y="15" width="6" height="35" fill="currentColor" />
      {/* Bitcoin sign drawn on the same 64 grid: a squared B with open
          counters and the two short strokes above and below, at 16.6 units
          tall so it still reads at favicon size. */}
      <g
        stroke="#cfeaff"
        strokeWidth="1.8"
        strokeLinecap="square"
        strokeLinejoin="miter"
      >
        <path d="M49.7 8.6V10.6M52.5 8.6V10.6M49.7 22.6V24.6M52.5 22.6V24.6" />
        <path d="M48.7 10.6V22.6" />
        <path d="M48.7 10.6H52.6L54.7 12.3V14.9L52.9 16.6L54.7 18.3V20.9L52.6 22.6H48.7" />
      </g>
    </svg>
    <span className="boot-wordmark__text" aria-hidden="true">
      <span className="boot-wordmark__name">JUSTSAYBITS</span>
    </span>
  </span>
);

export default Wordmark;
