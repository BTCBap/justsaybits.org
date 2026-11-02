import React, { useRef } from 'react';
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

  // A tap after a scroll is sometimes swallowed by the browser while the
  // scroller is still settling. Touch and pen therefore activate on
  // pointerup, and the compatibility click is ignored as the same tap.
  const touchTap = useRef<{ pointerId: number; x: number; y: number; moved: boolean } | null>(null);
  const activatedAt = useRef(0);

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
      onPointerDown={(event) => {
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
        touchTap.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          moved: false,
        };
      }}
      onPointerMove={(event) => {
        const tap = touchTap.current;
        if (!tap || tap.pointerId !== event.pointerId) return;
        if (Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 10) tap.moved = true;
      }}
      onPointerCancel={() => {
        touchTap.current = null;
      }}
      onPointerUp={(event) => {
        const tap = touchTap.current;
        touchTap.current = null;
        if (!tap || tap.pointerId !== event.pointerId || tap.moved) return;
        // Fire the link's own click so keyboard/mouse handlers, the confirm
        // tone, in-app navigation and target="_blank" all keep one path.
        event.currentTarget.click();
        // The browser's compatibility click follows immediately; remember
        // that this tap already ran so it cannot navigate twice.
        activatedAt.current = performance.now();
      }}
      onFocus={() => interaction.interact('cursor', { id: feedbackId, source: 'focus' })}
      onClick={(event) => {
        if (activatedAt.current && performance.now() - activatedAt.current < 800) {
          activatedAt.current = 0;
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        interaction.interact('confirm', { source: 'pointer' });
        onNavigate?.(event);
      }}
    >
      {leading && <div className="system-card__leading">{leading}</div>}

      <div className="system-card__main">
        {eyebrow && <p className="system-card__eyebrow">{eyebrow}</p>}

        <div className="system-card__head">
          <h3 className={`system-card__title ${titleClassName}`}>{title}</h3>
          {external && (
            <span className="system-card__external">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </span>
          )}
        </div>

        {meta && <span className="system-card__meta">{meta}</span>}

        {description && <p className="system-card__desc">{description}</p>}
        {children}

        {media}

        {footer && (
          <div className="system-card__foot">
            <span className="system-card__foot-text">{footer}</span>
          </div>
        )}
      </div>
    </a>
  );
};

export default SystemCard;
