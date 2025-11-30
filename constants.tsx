import React from 'react';
import { 
  IconSocial, 
  IconAbout, 
  IconPortfolio, 
  IconInvestments, 
  IconBook, 
  IconWritings, 
  IconHistory 
} from './components/Icons';
import { Section, PortfolioItem, InvestmentItem, BookItem, WritingItem, JobItem } from './types';

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
    thoughts: "Coming March 2026. A philosophical exploration of decentralized consensus.", 
    coverColor: "bg-orange-600" 
  },
];

export const WRITING_DATA: WritingItem[] = [
  { 
    title: "The Tao of the Twenty-First Century", 
    date: "Dec 01, 2025", 
    readTime: "4 min", 
    excerpt: "The scary part isn't that we're making powerful things. It's that the gap between what we can build and what we understand is widening.", 
    slug: "tao-21st-century",
    content: `We're living through something unprecedented. Not just the pace of change but the specific combination of what's changing. We can edit genes, talk to machines that seem intelligent, and we're close to making energy too cheap to meter. At the same time, we're building things we don't fully understand.\n\nThe scary part isn't that we're making powerful things. It's that the gap between what we can build and what we understand is widening. A programmer in 1970 could explain exactly how their code worked. Now we train neural networks that solve problems in ways their creators can't articulate. We're like mechanics who can make the car go faster without knowing why the engine works.\n\nBut here's what people miss: this has always been true. The farmers who domesticated wheat didn't understand genetics. The merchants who developed double-entry bookkeeping didn't have a theory of information. We've always been building on top of things we don't fully grasp.\n\nWhat's different now is we're conscious of it. And that consciousness might be the thing that saves us. Every powerful technology eventually becomes mundane. Electricity seemed magical and dangerous. Now it's boring. The question isn't whether we'll survive our own cleverness—we always have. It's whether we're brave enough to keep building things we don't yet understand, knowing that understanding follows use, not the other way around.\n\nWhat if the fear is just a part of growing pains?`
  },
];

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
  { id: 'writings', title: 'Essays', icon: IconWritings, description: 'Thoughts & Blogs', color: 'indigo', component: null },
];
