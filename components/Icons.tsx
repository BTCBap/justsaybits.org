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
    {/* User Profile Icon */}
    {/* Head */}
    <circle cx="32" cy="20" r="10" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.2" filter="url(#glow)" />
    {/* Shoulders/Body - 3D effect */}
    <path d="M12 52c0-11 9-20 20-20s20 9 20 20" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.1" filter="url(#glow)" />
    {/* Inner detail for depth */}
    <path d="M18 52c0-8 6.5-14 14-14s14 6 14 14" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
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
    {/* Open Book - centered */}
    {/* Left page */}
    <path d="M12 14 L12 50 L30 46 L30 10 Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" filter="url(#glow)" />
    {/* Right page */}
    <path d="M34 10 L34 46 L52 50 L52 14 Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2" filter="url(#glow)" />
    {/* Spine/binding */}
    <line x1="32" y1="10" x2="32" y2="47" stroke="currentColor" strokeWidth="2" strokeOpacity="0.4" />
    {/* Page lines (left) */}
    <line x1="16" y1="20" x2="26" y2="19" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
    <line x1="16" y1="26" x2="26" y2="25" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
    <line x1="16" y1="32" x2="26" y2="31" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
    {/* Page lines (right) */}
    <line x1="38" y1="19" x2="48" y2="20" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
    <line x1="38" y1="25" x2="48" y2="26" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
    <line x1="38" y1="31" x2="48" y2="32" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
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
    {/* 3D Briefcase - centered */}
    {/* Main body */}
    <rect x="10" y="28" width="44" height="24" rx="2" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2" filter="url(#glow)" />
    {/* Top depth/3D effect */}
    <path d="M10 28 L14 24 L58 24 L54 28 Z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.5" />
    {/* Side depth */}
    <path d="M54 28 L58 24 L58 48 L54 52 Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1" />
    {/* Handle */}
    <path d="M26 28 L26 20 C26 16 28 14 30 14 L34 14 C36 14 38 16 38 20 L38 28" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    {/* Lock/Clasp */}
    <rect x="30" y="36" width="4" height="6" fill="currentColor" fillOpacity="0.6" rx="1" />
    {/* Horizontal line detail */}
    <line x1="10" y1="40" x2="54" y2="40" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
  </svg>
);
