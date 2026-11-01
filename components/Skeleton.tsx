import React from 'react';

export const SkeletonLine: React.FC<{ width?: string; className?: string }> = ({
  width = '100%',
  className = '',
}) => (
  <span
    className={`skeleton-line ${className}`}
    aria-hidden="true"
    style={{ width }}
  />
);

export const SkeletonBlock: React.FC<{ height?: string; className?: string }> = ({
  height = '8rem',
  className = '',
}) => (
  <span
    className={`skeleton-block ${className}`}
    aria-hidden="true"
    style={{ height }}
  />
);

/** A list skeleton sized like the rows it replaces, so nothing moves on load. */
export const ListSkeleton: React.FC<{
  count?: number;
  label?: string;
  variant?: 'row' | 'card' | 'media';
}> = ({ count = 4, label = 'Loading content', variant = 'card' }) => (
  <div className="skeleton-list" role="status" aria-live="polite" aria-label={label}>
    <span className="sr-only">{label}…</span>
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className={`skeleton-item skeleton-item--${variant}`} aria-hidden="true">
        <SkeletonLine width={variant === 'card' ? '58%' : '72%'} className="skeleton-line--title" />
        <SkeletonLine width="100%" />
        <SkeletonLine width="82%" />
      </div>
    ))}
  </div>
);

/** Full-screen fallback for the lazy section chunk. */
export const ScreenSkeleton: React.FC = () => (
  <div
    className="screen-backdrop fixed inset-x-0 top-0 z-50 flex items-stretch justify-center px-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] md:p-12 bg-black/60"
    style={{ height: 'var(--app-height)' }}
    role="status"
    aria-live="polite"
    aria-label="Loading section"
  >
    <span className="sr-only">Loading section…</span>
    <div className="screen-panel skeleton-screen w-full max-w-5xl h-full min-h-0 flex flex-col border border-blue-500/30 rounded-lg overflow-hidden bg-[#050a14] shadow-[0_0_50px_rgba(0,50,255,0.15)]">
      <div className="shrink-0 h-16 border-b border-blue-500/30 flex items-center gap-4 px-6 bg-gradient-to-r from-blue-900/20 to-transparent">
        <span className="skeleton-square" aria-hidden="true" />
        <SkeletonLine width="10rem" className="skeleton-line--title" />
      </div>
      <div className="skeleton-screen__tabs" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonLine key={index} width="100%" />
        ))}
      </div>
      <div className="flex-1 min-h-0 p-6 md:p-10 space-y-4" aria-hidden="true">
        <SkeletonLine width="42%" />
        {[100, 92, 100, 84, 96].map((width, index) => (
          <div key={index} className="skeleton-item skeleton-item--card">
            <SkeletonLine width="56%" className="skeleton-line--title" />
            <SkeletonLine width={`${width}%`} />
            <SkeletonLine width="72%" />
          </div>
        ))}
      </div>
    </div>
  </div>
);
