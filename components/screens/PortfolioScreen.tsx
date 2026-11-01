import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  ExternalLink,
  Maximize2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { DESIGN_DATA, INVESTMENT_DATA, PORTFOLIO_DATA } from '../../constants';
import { interaction } from '../../utils/Interaction';
import { getFocusable } from '../../utils/focus';
import SafeImage from '../SafeImage';
import SystemCard from '../SystemCard';

const StatusMark: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'Active') return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />;
  if (status === 'Acquired') return <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />;
  if (status === 'Watching') return <Eye className="h-3.5 w-3.5" aria-hidden="true" />;
  return <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />;
};

export const ProjectsTab: React.FC = () => (
  <div className="project-grid">
    {PORTFOLIO_DATA.map((item) => (
      <SystemCard
        key={item.title}
        href={item.url ?? '#'}
        external={!!item.url}
        feedbackId={`project:${item.title}`}
        className="project-card"
        leading={<span className="project-year ps2-meta">{item.year}</span>}
        title={item.title}
        meta={item.role}
        description={item.description}
        footer={(
          <span className="project-tags">
            {item.tech.map(tech => (
              <span key={tech} className="project-tag">{tech}</span>
            ))}
          </span>
        )}
      >
        <span className="project-more" aria-hidden="true">More</span>
      </SystemCard>
    ))}
  </div>
);

export const InvestmentsTab: React.FC = () => (
  <div className="investment-wrap">
    <table className="investment-table">
      <caption className="sr-only">
        Investments by stage and current status. Status is shown with a mark and text.
      </caption>
      <thead>
        <tr>
          <th scope="col">Asset</th>
          <th scope="col">Stage / Type</th>
          <th scope="col" className="investment-status-head">Status</th>
        </tr>
      </thead>
      <tbody>
        {INVESTMENT_DATA.map((investment) => (
          <tr key={investment.asset}>
            <td data-label="Asset">
              {investment.url ? (
                <a
                  className="investment-asset investment-asset-link"
                  href={investment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {investment.asset}
                  <ExternalLink className="investment-asset__cue h-3 w-3" aria-hidden="true" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <span className="investment-asset">{investment.asset}</span>
              )}
              {investment.ticker && (
                <span className="investment-ticker ps2-meta">{investment.ticker}</span>
              )}
            </td>
            <td data-label="Stage / Type" className="investment-type">{investment.type}</td>
            <td data-label="Status" className="investment-status">
              <span className={`status-pill ${
                investment.status === 'Active' ? 'status-pill--active' :
                investment.status === 'Acquired' ? 'status-pill--acquired' :
                investment.status === 'Exited' ? 'status-pill--exited' :
                'status-pill--watching'
              }`}>
                <StatusMark status={investment.status} />
                {investment.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

interface DesignLightboxProps {
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  /** The tile that opened the viewer; touch taps may not leave it focused. */
  returnFocus?: HTMLElement | null;
}

const DesignLightbox: React.FC<DesignLightboxProps> = ({
  index,
  onClose,
  onIndexChange,
  returnFocus = null,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(
    returnFocus ?? (typeof document !== 'undefined' ? document.activeElement as HTMLElement : null),
  );
  const item = DESIGN_DATA[index];
  const total = DESIGN_DATA.length;

  useEffect(() => {
    const panel = document.querySelector<HTMLElement>('.screen-panel');
    const focusTarget = returnFocusRef.current;
    panel?.setAttribute('inert', '');
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      panel?.removeAttribute('inert');
      focusTarget?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        event.stopPropagation();
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        onIndexChange((index + delta + total) % total);
        return;
      }
      if (event.key === 'Tab') {
        const focusable = getFocusable(dialogRef.current);
        if (focusable.length === 0) {
          event.preventDefault();
          dialogRef.current?.focus({ preventScroll: true });
          return;
        }
        const active = document.activeElement as HTMLElement | null;
        const at = active ? focusable.indexOf(active) : -1;
        if (event.shiftKey && at <= 0) {
          event.preventDefault();
          focusable[focusable.length - 1].focus({ preventScroll: true });
        } else if (!event.shiftKey && (at === -1 || at === focusable.length - 1)) {
          event.preventDefault();
          focusable[0].focus({ preventScroll: true });
        }
        event.stopPropagation();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [index, onClose, onIndexChange, total]);

  if (!item) return null;

  return (
    <div
      className="lightbox"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lightbox-title"
        aria-describedby="lightbox-alt"
        tabIndex={-1}
        className="lightbox__panel"
      >
        <div className="lightbox__bar">
          <p className="lightbox__count ps2-meta">
            {index + 1} / {total}
          </p>
          <button ref={closeRef} type="button" className="lightbox__button" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Close image viewer</span>
          </button>
        </div>

        <div className="lightbox__stage">
          <SafeImage
            src={item.image}
            srcSet={item.srcSet}
            sizes="(min-width: 1024px) 70vw, 92vw"
            alt={item.alt}
            className="lightbox__image"
            imageClassName="lightbox__img"
            fallbackLabel="Image unavailable"
          />
        </div>

        <div className="lightbox__caption">
          <h2 id="lightbox-title">{item.title}</h2>
          <p className="ps2-meta">{item.type}</p>
          <p id="lightbox-alt" className="lightbox__alt">{item.alt}</p>
        </div>

        <div className="lightbox__nav">
          <button
            type="button"
            className="lightbox__button"
            onClick={() => onIndexChange((index - 1 + total) % total)}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Previous image</span>
          </button>
          <button
            type="button"
            className="lightbox__button"
            onClick={() => onIndexChange((index + 1) % total)}
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Next image</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const DesignTab: React.FC = () => {
  const [active, setActive] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div className="design-wrap">
      <div className="design-grid">
        {DESIGN_DATA.map((item, index) => (
          <figure key={item.image} className="design-tile">
            <button
              type="button"
              className="design-tile__button"
              aria-haspopup="dialog"
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                interaction.interact('confirm', { source: 'pointer' });
                setActive(index);
              }}
              onFocus={() => interaction.interact('cursor', { id: `design:${item.image}`, source: 'focus' })}
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse') {
                  interaction.interact('cursor', { id: `design:${item.image}`, source: 'hover' });
                }
              }}
            >
              <SafeImage
                src={item.image}
                srcSet={item.srcSet}
                sizes={item.sizes}
                alt={item.alt}
                width={item.width}
                height={item.height}
                className="design-tile__image"
                imageClassName="design-tile__img"
              />
              <span className="design-tile__caption">
                <span className="design-tile__title">{item.title}</span>
                <span className="design-tile__type ps2-meta">{item.type}</span>
              </span>
              <span className="design-tile__zoom" aria-hidden="true">
                <Maximize2 className="h-3.5 w-3.5" />
                View
              </span>
            </button>
          </figure>
        ))}
      </div>

      {active !== null && (
        <DesignLightbox
          index={active}
          returnFocus={triggerRef.current}
          onClose={() => setActive(null)}
          onIndexChange={(next) => {
            setActive(next);
            interaction.interact('cursor', { id: `design:${DESIGN_DATA[next]?.image}`, source: 'pointer' });
          }}
        />
      )}
    </div>
  );
};
