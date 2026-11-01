import React from 'react';

interface WordmarkProps {
  /** Hide the mark from assistive tech when a labelled heading is present. */
  decorative?: boolean;
  className?: string;
}

/**
 * Original justsaybits identity: three ascending "bits" inside a thin frame,
 * with a bloom dot. The same lockup is used on the power-on gate and the boot
 * payoff so the two screens read as one system.
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
      <circle cx="49.6" cy="16.4" r="2.4" fill="#cfeaff" />
    </svg>
    <span className="boot-wordmark__text" aria-hidden="true">
      <span className="boot-wordmark__name">JUSTSAYBITS</span>
    </span>
  </span>
);

export default Wordmark;
