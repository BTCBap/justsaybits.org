import React, { useRef } from 'react';
import { interaction } from '../utils/Interaction';

export interface TabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface TabsProps {
  /** Prefix for the tab/panel ids; one per tab set. */
  baseId: string;
  label: string;
  items: readonly TabItem[];
  activeId: string;
  onChange: (id: string, source: 'pointer' | 'keyboard') => void;
  /** Content hubs lay out as two rows of three on phones; portfolio is one row. */
  layout?: 'content' | 'portfolio';
  className?: string;
}

export const tabId = (baseId: string, id: string): string => `${baseId}-tab-${id}`;
export const tabPanelId = (baseId: string, id: string): string => `${baseId}-panel-${id}`;

/**
 * One WAI-ARIA Tabs implementation for Content and Portfolio: roving tabindex,
 * selection follows focus, Left/Right/Home/End, and one focus treatment.
 */
const Tabs: React.FC<TabsProps> = ({
  baseId,
  label,
  items,
  activeId,
  onChange,
  layout = 'content',
  className = '',
}) => {
  const refs = useRef(new Map<string, HTMLButtonElement>());

  const select = (index: number) => {
    const item = items[index];
    if (!item) return;
    onChange(item.id, 'keyboard');
    refs.current.get(item.id)?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    const last = items.length - 1;
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next === null) return;
    event.preventDefault();
    select(next);
  };

  const containerClass = layout === 'content'
    ? 'grid grid-cols-3 md:flex'
    : 'flex';

  return (
    <div
      role="tablist"
      aria-label={label}
      className={`tabs ${containerClass} w-full border-b border-blue-400/25 bg-[var(--bg)] px-1 md:px-4 ${className}`}
    >
      {items.map((item, index) => {
        const active = item.id === activeId;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            ref={(element) => {
              if (element) refs.current.set(item.id, element);
              else refs.current.delete(item.id);
            }}
            type="button"
            role="tab"
            id={tabId(baseId, item.id)}
            aria-selected={active}
            aria-controls={tabPanelId(baseId, item.id)}
            tabIndex={active ? 0 : -1}
            onClick={() => {
              onChange(item.id, 'pointer');
              refs.current.get(item.id)?.focus({ preventScroll: true });
            }}
            onFocus={() => interaction.interact('cursor', { id: `${baseId}-tab:${item.id}`, source: 'focus' })}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`tab flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-2 pb-0 pt-0 font-sans text-[12px] uppercase tracking-[0.14em] transition-colors md:flex-1 md:gap-2 md:tracking-[0.16em] ${
              active
                ? 'tab--active border-blue-300 bg-blue-500/15 text-white'
                : 'border-transparent text-[var(--text-secondary)] hover:bg-blue-500/10 hover:text-white'
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" />
            <span className="leading-none">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
