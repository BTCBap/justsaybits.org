import React from 'react';

interface HelpBarProps {
  /** The screen's keyboard help, announced to assistive technology only. */
  description: string;
}

/**
 * Screen-reader help for the current screen. The visible keycaps and touch
 * legend are gone by design: controls name themselves and the PS2 chrome stays
 * quiet.
 */
const HelpBar: React.FC<HelpBarProps> = ({ description }) => (
  <p className="sr-only">{description}</p>
);

export default HelpBar;
