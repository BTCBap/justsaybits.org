import React from 'react';

export interface Section {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  description: string;
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

export interface InvestmentItem {
  asset: string;
  ticker?: string;
  type: string;
  status: 'Active' | 'Exited' | 'Watching' | 'Acquired';
}

export interface BookItem {
  title: string;
  subtitle?: string;
  author: string;
  rating: number; // 1-5
  thoughts: string;
  coverColor: string;
  coverImage?: string;
  url?: string;
}

export interface EssayItem {
  title: string;
  date: string;
  readTime: string;
  excerpt: string;
  slug: string;
  content: string;
}

export interface JobItem {
  company: string;
  role?: string; // Optional if using subRoles
  period: string;
  location: string;
  highlights: string[];
  subRoles?: { title: string; period: string }[];
}