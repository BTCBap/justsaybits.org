import React from 'react';

// Common props for consistency
interface IconProps {
  className?: string;
}

// Helper to create the 3D-ish glow effect
const GlowFilter = () => (
  <defs>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
);

export const IconSocial: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <GlowFilter />
    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="2" strokeOpacity="0.8" filter="url(#glow)" />
    <ellipse cx="32" cy="32" rx="28" ry="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.6" />
    <ellipse cx="32" cy="32" rx="10" ry="28" stroke="currentColor" strokeWidth="2" strokeOpacity="0.6" />
    <path d="M10 32h44M32 10v44" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
  </svg>
);

export const IconAbout: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <GlowFilter />
    {/* Memory Card Shape */}
    <path d="M12 16h40v40H12z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.1" filter="url(#glow)" />
    <path d="M16 12h32v8H16z" fill="currentColor" fillOpacity="0.3" />
    {/* Connector Pins */}
    <rect x="20" y="50" width="4" height="6" fill="currentColor" />
    <rect x="28" y="50" width="4" height="6" fill="currentColor" />
    <rect x="36" y="50" width="4" height="6" fill="currentColor" />
    <rect x="44" y="50" width="4" height="6" fill="currentColor" />
  </svg>
);

export const IconPortfolio: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <GlowFilter />
    {/* Disc */}
    <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="2" fill="url(#discGradient)" filter="url(#glow)" />
    <circle cx="32" cy="32" r="8" stroke="currentColor" strokeWidth="2" fill="transparent" />
    <defs>
      <linearGradient id="discGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.1" />
        <stop offset="50%" stopColor="currentColor" stopOpacity="0.3" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
      </linearGradient>
    </defs>
  </svg>
);

export const IconInvestments: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <GlowFilter />
    {/* 3D Bars */}
    <path d="M12 48l10-10v-8l-10 10v8z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" />
    <path d="M12 40h10v8H12z" fill="currentColor" fillOpacity="0.4" />
    
    <path d="M26 48l10-10v-20l-10 10v20z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" />
    <path d="M26 28h10v20H26z" fill="currentColor" fillOpacity="0.5" />
    
    <path d="M40 48l10-10v-30l-10 10v30z" fill="currentColor" fillOpacity="0.4" stroke="currentColor" />
    <path d="M40 18h10v30H40z" fill="currentColor" fillOpacity="0.6" />
  </svg>
);

export const IconBook: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <GlowFilter />
    {/* 3D Book */}
    <path d="M16 12h24l8 8v32h-24l-8-8V12z" stroke="currentColor" strokeWidth="2" filter="url(#glow)" />
    <path d="M16 12l8 8" stroke="currentColor" />
    <path d="M40 12l8 8" stroke="currentColor" />
    <path d="M40 44l8 8" stroke="currentColor" />
    <path d="M24 20h16" stroke="currentColor" strokeOpacity="0.5" />
    <path d="M24 28h16" stroke="currentColor" strokeOpacity="0.5" />
    <path d="M24 36h16" stroke="currentColor" strokeOpacity="0.5" />
  </svg>
);

export const IconWritings: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <GlowFilter />
    {/* Scroll/Pen */}
    <path d="M44 8L12 40v12h12l32-32-12-12z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.2" filter="url(#glow)" />
    <path d="M12 52l6-6" stroke="currentColor" />
    <path d="M40 12l8 8" stroke="currentColor" />
    <line x1="20" y1="44" x2="48" y2="16" stroke="currentColor" strokeWidth="1" />
  </svg>
);

export const IconHistory: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <GlowFilter />
    {/* Clock/Hourglass hybrid */}
    <circle cx="32" cy="32" r="24" stroke="currentColor" strokeWidth="2" filter="url(#glow)" />
    <path d="M32 8v24l12 12" stroke="currentColor" strokeWidth="2" />
    <circle cx="32" cy="32" r="2" fill="currentColor" />
    <path d="M32 8a2 2 0 0 1 0 4 2 2 0 0 1 0-4" fill="currentColor" />
    <path d="M32 52a2 2 0 0 1 0 4 2 2 0 0 1 0-4" fill="currentColor" />
    <path d="M52 32a2 2 0 0 1 4 0 2 2 0 0 1-4 0" fill="currentColor" />
    <path d="M8 32a2 2 0 0 1 4 0 2 2 0 0 1-4 0" fill="currentColor" />
  </svg>
);
