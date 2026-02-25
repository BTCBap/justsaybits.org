import React from 'react';
import {
  IconSocial,
  IconAbout,
  IconPortfolio,
  IconInvestments,
  IconBook,
  IconEssays,
  IconHistory
} from './components/Icons';
import { Section, PortfolioItem, InvestmentItem, BookItem, EssayItem, JobItem } from './types';
import { ESSAYS } from './data/essays';

// --- Content Data ---

export const PORTFOLIO_DATA: PortfolioItem[] = [
  {
    title: "Hax Wallet",
    role: "Contributor",
    year: "2025",
    description: "A surprisingly feature-rich open source bitcoin TUI wallet built with modern standards.",
    tech: ["Bitcoin", "Go", "TUI"],
    url: "https://github.com/hax-wallet/hax-wallet"
  },
  {
    title: "The Space",
    role: "Co-Founder",
    year: "2024",
    description: "A thriving member-operated bitcoin community and nonprofit organization building the premier place for collaboration, education, and freedom technology in the Rocky Mountain Region.",
    tech: ["Community", "Bitcoin", "Non-profit"],
    url: "https://denver.space"
  }
];

export const INVESTMENT_DATA: InvestmentItem[] = [
  { asset: "Personal Capital", type: "Equity", status: "Acquired" },
  { asset: "Casa Inc.", type: "Equity", status: "Active" },
  { asset: "Foundation Devices", type: "Seed", status: "Active" },
  { asset: "Strike Inc.", type: "Series A", status: "Active" },
];

export const BOOK_DATA: BookItem[] = [
  {
    title: "The Bitcoin Tao",
    author: "Zach Wischler",
    rating: 5,
    subtitle: "The Book of the Bitcoin Way and Its Virtue",
    thoughts: "Where ancient wisdom meets the future of money. The Bitcoin Tao explores the profound parallels between Taoist philosophy and the principles that underpin Bitcoin — decentralization, harmony, patience, and the natural order of sound money. This is more than a book. It's a meditation on why Bitcoin isn't just a technology, but a return to the way things were always meant to be.",
    coverColor: "bg-orange-600",
    coverImage: "/bitcoin-tao-cover.jpeg",
    url: "https://store.bitcoinmagazine.com/pages/the-bitcoin-tao",
  },
];

// Essays are now maintained in ./data/essays.ts for easier management
export const ESSAY_DATA: EssayItem[] = ESSAYS;

export const WORK_DATA: JobItem[] = [
  {
    company: "Casa Inc.",
    period: "4 yrs 8 mos",
    location: "Denver, Colorado, United States",
    highlights: [],
    subRoles: [
      { title: "Director of Sales", period: "Dec 2025 - Present" },
      { title: "Sales Manager", period: "Apr 2024 - Dec 2025" },
      { title: "Account Executive", period: "Apr 2021 - Mar 2024" }
    ]
  },
  {
    company: "The Space Education Foundation",
    role: "President",
    period: "Jan 2023 - Present",
    location: "Denver, Colorado, United States",
    highlights: []
  },
  {
    company: "The Space",
    role: "Co-Founder and Board Member",
    period: "Apr 2024 - Present",
    location: "Denver, Colorado, United States",
    highlights: []
  },
  {
    company: "iCIMS",
    role: "Account Executive",
    period: "Sep 2020 - Apr 2021",
    location: "Denver, Colorado, United States",
    highlights: []
  },
  {
    company: "Personal Capital",
    period: "2 yrs 4 mos",
    location: "Denver, Colorado, United States",
    highlights: [],
    subRoles: [
      { title: "Senior Financial Advisor", period: "Jun 2019 - Mar 2020" },
      { title: "Financial Advisor", period: "Dec 2017 - Jun 2019" }
    ]
  },
  {
    company: "Merrill Lynch",
    role: "Financial Advisor",
    period: "Sep 2014 - Mar 2017",
    location: "New Orleans, Louisiana, United States",
    highlights: []
  }
];

export const SOCIAL_LINKS = [
  { platform: "Twitter/X", url: "https://x.com/btcbap", handle: "@btcbap" },
  { platform: "LinkedIn", url: "https://www.linkedin.com/in/zach-wischler/", handle: "zach-wischler" },
  { platform: "Email", url: "mailto:zach@justsaybits.org", handle: "zach@justsaybits.org" },
];

export const SECTIONS: Section[] = [
  { id: 'about', title: 'About', icon: IconAbout, description: 'Mission & Values', color: 'purple', component: null },
  { id: 'social', title: 'Social', icon: IconSocial, description: 'Connect with me', color: 'blue', component: null },
  { id: 'work', title: 'Work', icon: IconHistory, description: 'Career History', color: 'cyan', component: null },
  { id: 'portfolio', title: 'Portfolio', icon: IconInvestments, description: 'Works & Assets', color: 'green', component: null },
  { id: 'book', title: 'Book', icon: IconBook, description: 'The Bitcoin Tao', color: 'red', component: null },
  { id: 'essays', title: 'Essays', icon: IconEssays, description: 'Thoughts & Blogs', color: 'indigo', component: null },
];
