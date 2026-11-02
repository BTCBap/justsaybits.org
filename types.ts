import React from 'react';

export interface Section {
  id: string;
  title: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
  component: React.ReactNode;
}

export interface PortfolioItem {
  title: string;
  role: string;
  year: string;
  description: string;
  tech: string[];
  url?: string;
}

export interface DesignItem {
  title: string;
  type: string;
  image: string;
  alt: string;
  width: number;
  height: number;
  srcSet?: string;
  sizes?: string;
}

export interface InvestmentItem {
  asset: string;
  url: string;
  logo: string;
}

export interface BookItem {
  title: string;
  subtitle?: string;
  author: string;
  rating: number; // 1-5
  thoughts: string;
  coverColor: string;
  coverImage?: string;
  coverSrcSet?: string;
  coverWidth?: number;
  coverHeight?: number;
  url?: string;
}

export interface EssaySummary {
  title: string;
  date: string;
  readTime: string;
  excerpt: string;
  slug: string;
  sourceLabel?: string;
  sourceUrl?: string;
}

export interface EssayItem extends EssaySummary {
  content: string;
}

export interface MediaItem {
  title: string;
  url: string;
  source: string;
  date?: string;
  /** Tutorials: how the item is delivered. */
  format?: 'Video' | 'Guide';
  /** Tutorials: the one-line result the reader gets. */
  outcome?: string;
}

export interface ReadingItem {
  title: string;
  author: string;
  url: string;
  date: string;
}

export interface PostItem {
  id: string;
  text: string;
  date: string;
  likes: number;
  reposts: number;
  replies: number;
  quotes?: number;
  bookmarks?: number;
  image?: string;
  url: string;
}

export type ContentTab = 'essays' | 'posts' | 'podcasts' | 'lectures' | 'tutorials' | 'reading';

export interface JobItem {
  company: string;
  role?: string; // Optional if using subRoles
  period: string;
  location: string;
  highlights: string[];
  subRoles?: { title: string; period: string }[];
}