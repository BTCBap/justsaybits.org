import React from 'react';

interface WordmarkProps {
  /** Hide the mark from assistive tech when a labelled heading is present. */
  decorative?: boolean;
  className?: string;
}

/**
 * Original justsaybits identity: one clean Bitcoin sign, then the wordmark.
 * The same mark is used on the power-on gate, the boot payoff and the favicon
 * so the three screens read as one system.
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
      {/* A squared ₿ on the 64 grid: open counters, two ticks above and two
          below, 50 units tall so it stays legible down to 16 px. */}
      <g
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="square"
        strokeLinejoin="miter"
      >
        <path d="M24 7V13M31 7V13M24 51V57M31 51V57" />
        <path d="M20 13V51" />
        <path d="M20 13H32.5A8.5 8.5 0 0 1 32.5 30H20" />
        <path d="M20 30H34A10.5 10.5 0 0 1 34 51H20" />
      </g>
    </svg>
    <span className="boot-wordmark__text" aria-hidden="true">
      <span className="boot-wordmark__name">JUSTSAYBITS</span>
    </span>
  </span>
);

export default Wordmark;
