import React from 'react';
import { ExternalLink } from 'lucide-react';
import { interaction } from '../utils/Interaction';

export interface SystemCardProps {
  href: string;
  /** Stable id for one cursor tick per row, whichever input moved. */
  feedbackId: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  /** Extra body between the description and the media/footer. */
  children?: React.ReactNode;
  media?: React.ReactNode;
  footer?: React.ReactNode;
  /** A left rail cell (year, index) that makes the row read as a file list. */
  leading?: React.ReactNode;
  external?: boolean;
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
  titleClassName?: string;
  innerRef?: React.Ref<HTMLAnchorElement>;
}

/**
 * The single card/row treatment used by every list: one link target per item,
 * rest / hover / focus / pressed states, and a persistent external cue.
 */
const SystemCard: React.FC<SystemCardProps> = ({
  href,
  feedbackId,
  title,
  meta,
  eyebrow,
  description,
  children,
  media,
  footer,
  leading,
  external = false,
  onNavigate,
  className = '',
  titleClassName = '',
  innerRef,
}) => {
  const externalProps = external
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};

  return (
    <a
      ref={innerRef}
      href={href}
      {...externalProps}
      className={`system-card group ${leading ? 'system-card--row' : ''} ${className}`}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') {
          interaction.interact('cursor', { id: feedbackId, source: 'hover' });
        }
      }}
      onFocus={() => interaction.interact('cursor', { id: feedbackId, source: 'focus' })}
      onClick={(event) => {
        interaction.interact('confirm', { source: 'pointer' });
        onNavigate?.(event);
      }}
    >
      {leading && <div className="system-card__leading">{leading}</div>}

      <div className="system-card__main">
        {eyebrow && <p className="system-card__eyebrow">{eyebrow}</p>}

        <div className="system-card__head">
          <h3 className={`system-card__title ${titleClassName}`}>{title}</h3>
          {meta && <span className="system-card__meta">{meta}</span>}
        </div>

        {description && <p className="system-card__desc">{description}</p>}
        {children}

        {media}

        <div className="system-card__foot">
          <span className="system-card__foot-text">{footer}</span>
          {external && (
            <span className="system-card__external">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </span>
          )}
        </div>
      </div>
    </a>
  );
};

export default SystemCard;
