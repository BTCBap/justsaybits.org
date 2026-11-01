import React from 'react';
import { interaction } from '../utils/Interaction';
import { navigate } from '../utils/router';

interface ScreenLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** In-app route; a real href keeps middle-click and copy-link working. */
  to: string;
  feedbackId?: string;
}

/**
 * A same-app link that keeps the shell mounted. Modified clicks stay native so
 * a new tab can still open the canonical URL.
 */
const ScreenLink: React.FC<ScreenLinkProps> = ({
  to,
  feedbackId,
  onClick,
  onFocus,
  children,
  ...rest
}) => (
  <a
    href={to}
    onFocus={(event) => {
      if (feedbackId) interaction.interact('cursor', { id: feedbackId, source: 'focus' });
      onFocus?.(event);
    }}
    onClick={(event) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      interaction.interact('confirm', { source: 'pointer' });
      navigate(to);
    }}
    {...rest}
  >
    {children}
  </a>
);

export default ScreenLink;
