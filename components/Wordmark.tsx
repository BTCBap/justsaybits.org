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
      {/* Bitcoin mark: squared B on the 64 grid, counters kept open for small sizes. */}
      <path
        d="M48 13H52.4V20H48Z M49.5 14H51.3V15.5H49.5Z M49.5 16.5H51.3V19H49.5Z"
        fill="#cfeaff"
        fillRule="evenodd"
      />
      <path
        d="M49 12H50V13H49Z M51 12H52V13H51Z M49 20H50V21H49Z M51 20H52V21H51Z"
        fill="#cfeaff"
      />
    </svg>
    <span className="boot-wordmark__text" aria-hidden="true">
      <span className="boot-wordmark__name">JUSTSAYBITS</span>
    </span>
  </span>
);

export default Wordmark;
