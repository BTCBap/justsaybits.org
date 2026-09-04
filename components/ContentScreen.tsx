import React, { useState, useEffect, useRef } from 'react';
import { motion, Variants } from 'framer-motion';
import {
  ArrowLeft,
  LayoutGrid,
  TrendingUp,
  ExternalLink,
  FileText,
  Mic,
  GraduationCap,
  MonitorPlay,
  BookOpen,
  MessageCircle,
} from 'lucide-react';
import {
  PORTFOLIO_DATA,
  INVESTMENT_DATA,
  BOOK_DATA,
  ESSAY_DATA,
  WORK_DATA,
  SOCIAL_LINKS,
  PODCASTS_VALUE_STACK,
  PODCASTS_APPEARANCES,
  LECTURES,
  TUTORIALS,
  READING_LIST,
  POSTS,
} from '../constants';
import { Section, EssayItem, MediaItem, ReadingItem, PostItem, ContentTab } from '../types';
import { soundManager } from '../utils/SoundManager';
import { hapticManager } from '../utils/HapticManager';

interface ContentScreenProps {
  section: Section;
  onBack: () => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" }
  },
  exit: { 
    opacity: 0, 
    scale: 1.05, 
    filter: "blur(10px)",
    transition: { duration: 0.3 } 
  }
};

const CONTENT_TABS: { id: ContentTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'essays', label: 'Essays', icon: FileText },
  { id: 'posts', label: 'Posts', icon: MessageCircle },
  { id: 'podcasts', label: 'Podcasts', icon: Mic },
  { id: 'lectures', label: 'Lectures', icon: GraduationCap },
  { id: 'tutorials', label: 'Tutorials', icon: MonitorPlay },
  { id: 'reading', label: 'Reading', icon: BookOpen },
];

const postEngagement = (p: PostItem) =>
  p.likes + p.reposts * 2 + p.replies + (p.quotes ?? 0) + (p.bookmarks ?? 0);

const RANKED_POSTS = [...POSTS].sort((a, b) => postEngagement(b) - postEngagement(a));

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  const re = /(\*\*[\s\S]*?\*\*|\*[^*\n]+?\*|\[[^\]]+\]\([^)]+\))/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) {
      parts.push(text.slice(last, m.index));
    }
    const tok = m[0];
    if (tok.startsWith('**') && tok.endsWith('**') && tok.length >= 4) {
      parts.push(
        <span key={`${keyPrefix}-b-${i++}`} className="font-bold text-white text-base md:text-lg tracking-wide">
          {tok.slice(2, -2)}
        </span>
      );
    } else if (tok.startsWith('*') && tok.endsWith('*') && tok.length >= 2) {
      parts.push(<em key={`${keyPrefix}-i-${i++}`}>{tok.slice(1, -1)}</em>);
    } else {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (lm) {
        parts.push(
          <a
            key={`${keyPrefix}-a-${i++}`}
            href={lm[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline underline-offset-2 hover:text-white"
          >
            {lm[1]}
          </a>
        );
      } else {
        parts.push(tok);
      }
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

const EssayBody: React.FC<{ content: string }> = ({ content }) => {
  const nodes: React.ReactNode[] = [];
  const re = /%%(YOUTUBE|IMAGE|TWEET):([\s\S]*?)%%/g;
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    if (m.index > last) {
      const text = content.slice(last, m.index);
      if (text.length) {
        nodes.push(
          <div key={`t-${i++}`} className="whitespace-pre-wrap leading-relaxed">
            {renderInline(text, `t${i}`)}
          </div>
        );
      }
    }
    try {
      const data = JSON.parse(m[2]);
      if (m[1] === 'YOUTUBE' && data.id) {
        const start = data.start ? `&start=${encodeURIComponent(data.start)}` : '';
        nodes.push(
          <div key={`yt-${i++}`} className="my-6 w-full overflow-hidden border border-blue-500/30 bg-black/40">
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube-nocookie.com/embed/${data.id}?rel=0${start}`}
                title="YouTube video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          </div>
        );
      } else if (m[1] === 'IMAGE' && data.src) {
        nodes.push(
          <figure key={`img-${i++}`} className="my-6">
            <img
              src={data.src}
              alt={data.alt || data.caption || ''}
              className="max-w-full w-full h-auto object-contain border border-blue-500/20"
            />
            {data.caption && (
              <figcaption className="mt-2 text-xs text-blue-400/80 font-mono italic">
                {renderInline(data.caption, `cap${i}`)}
              </figcaption>
            )}
          </figure>
        );
      } else if (m[1] === 'TWEET') {
        nodes.push(
          <a
            key={`tw-${i++}`}
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="my-6 block border border-blue-500/30 bg-blue-900/10 p-4 hover:border-blue-400 transition-colors"
          >
            <div className="text-white font-bold">{data.name}</div>
            {data.username && (
              <div className="text-xs text-blue-400 font-mono mb-2">@{data.username}</div>
            )}
            <p className="text-sm text-blue-100 whitespace-pre-wrap">{data.text}</p>
          </a>
        );
      }
    } catch {
      // skip malformed media tokens
    }
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    const text = content.slice(last);
    if (text.length) {
      nodes.push(
        <div key={`t-${i++}`} className="whitespace-pre-wrap leading-relaxed">
          {renderInline(text, `t${i}`)}
        </div>
      );
    }
  }
  return <>{nodes}</>;
};

const scrollbarStyles = `
  .ps2-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .ps2-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .ps2-scroll::-webkit-scrollbar-thumb {
    background: rgba(100, 150, 255, 0.15);
    border-radius: 3px;
  }
  .ps2-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(100, 150, 255, 0.4);
  }
  .ps2-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(100, 150, 255, 0.15) transparent;
    scrollbar-gutter: stable;
  }
`;

const ContentScreen: React.FC<ContentScreenProps> = ({ section, onBack }) => {
  const [portfolioTab, setPortfolioTab] = useState<'projects' | 'investments'>('projects');
  const [contentTab, setContentTab] = useState<ContentTab>('essays');
  const [selectedEssay, setSelectedEssay] = useState<EssayItem | null>(null);
  const contentMounted = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo(0, 0);
  }, [selectedEssay, contentTab, section.id]);

  // Track virtual pageviews for content tabs / essay reader (skip initial mount — section open is tracked by App.tsx)
  useEffect(() => {
    if (section.id !== 'content') return;
    if (!contentMounted.current) { contentMounted.current = true; return; }
    const url = selectedEssay
      ? `/content/essays/${selectedEssay.slug}`
      : `/content/${contentTab}`;
    const title = selectedEssay ? selectedEssay.title : `Content / ${contentTab}`;
    window.umami?.track(props => ({ ...props, url, title }));
  }, [selectedEssay, contentTab, section.id]);

  const handleBack = () => {
    soundManager.playBack();
    hapticManager.medium();
    if (selectedEssay) {
      setSelectedEssay(null);
    } else {
      onBack();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') {
        handleBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEssay, onBack]);

  const handleTabChange = (tab: 'projects' | 'investments') => {
    if (portfolioTab !== tab) {
      soundManager.playHover();
      hapticManager.light();
      setPortfolioTab(tab);
    }
  };

  const handleContentTabChange = (tab: ContentTab) => {
    if (contentTab !== tab) {
      soundManager.playHover();
      hapticManager.light();
      setContentTab(tab);
      setSelectedEssay(null);
    }
  };

  const renderMediaCard = (item: MediaItem, extra?: string) => (
    <a
      key={item.url}
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-blue-900/10 border border-transparent hover:border-blue-500/30 p-6 rounded transition-all duration-300"
      onMouseEnter={() => {
        soundManager.playHover();
        hapticManager.light();
      }}
      onClick={() => { hapticManager.medium(); }}
    >
      <div className="flex items-baseline justify-between gap-4 mb-2 border-b border-blue-500/30 pb-2">
        <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors ps2-text-shadow">
          {item.title}
        </h3>
        {item.date && <span className="font-mono text-xs text-blue-500 shrink-0">{item.date}</span>}
      </div>
      <div className="flex items-center text-xs text-blue-400 font-mono uppercase tracking-wider group-hover:text-white transition-colors">
        <span>{extra || item.source}</span>
        <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </a>
  );

  const renderPostCard = (item: PostItem) => {
    const raw = item.text.trim() || 'View post';
    const title = raw.length > 160 ? `${raw.slice(0, 157).trimEnd()}…` : raw;
    return (
    <a
      key={item.id}
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-blue-900/10 border border-transparent hover:border-blue-500/30 p-6 rounded transition-all duration-300"
      onMouseEnter={() => {
        soundManager.playHover();
        hapticManager.light();
      }}
      onClick={() => { hapticManager.medium(); }}
    >
      <div className="flex items-baseline justify-between gap-4 mb-2 border-b border-blue-500/30 pb-2">
        <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors ps2-text-shadow">
          {title}
        </h3>
        <span className="font-mono text-xs text-blue-500 shrink-0">{item.date}</span>
      </div>
      {item.image && (
        <div className="mb-4 flex justify-center border border-blue-500/20 bg-black/30">
          <img
            src={item.image}
            alt=""
            referrerPolicy="no-referrer"
            className="max-h-96 max-w-full w-auto h-auto object-contain"
          />
        </div>
      )}
      <div className="flex items-center text-xs text-blue-400 font-mono uppercase tracking-wider group-hover:text-white transition-colors">
        <span>@BTCBap</span>
        <span className="mx-2">::</span>
        <span>{item.likes.toLocaleString()} likes</span>
        <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </a>
    );
  };

  const renderReadingCard = (item: ReadingItem) => (
    <a
      key={item.url}
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-blue-900/10 border border-transparent hover:border-blue-500/30 p-6 rounded transition-all duration-300"
      onMouseEnter={() => {
        soundManager.playHover();
        hapticManager.light();
      }}
      onClick={() => { hapticManager.medium(); }}
    >
      <div className="flex items-baseline justify-between gap-4 mb-2 border-b border-blue-500/30 pb-2">
        <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors ps2-text-shadow">
          {item.title}
        </h3>
        <span className="font-mono text-xs text-blue-500 shrink-0">{item.date}</span>
      </div>
      <div className="flex items-center text-xs text-blue-400 font-mono uppercase tracking-wider group-hover:text-white transition-colors">
        <span>{item.author}</span>
        <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </a>
  );

  // Render Helpers
  const renderSocials = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
      {SOCIAL_LINKS.map((link, i) => (
        <a
          key={i}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group block bg-blue-900/20 border border-blue-500/30 p-6 hover:bg-blue-800/40 transition-all duration-200"
          onMouseEnter={() => {
            soundManager.playHover();
            hapticManager.light();
          }}
          onClick={() => { hapticManager.medium(); window.umami?.track('social-click', { platform: link.platform }); }}
        >
          <div className="text-blue-400 text-xs tracking-widest uppercase mb-1">{link.platform}</div>
          <div className="text-xl font-mono text-white group-hover:ps2-text-shadow flex items-center justify-between">
            {link.handle}
            <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </a>
      ))}
    </div>
  );

  const renderAbout = () => (
    <div className="max-w-3xl mx-auto space-y-8 text-blue-100 font-light">
      <div className="flex justify-center">
        <div className="border border-blue-500/40 p-1 bg-black/40 shadow-[0_0_28px_rgba(50,100,255,0.28)]">
          <img
            src="/about-portrait.png"
            alt="Zach Wischler"
            className="block w-36 md:w-40 h-auto"
          />
        </div>
      </div>

      <div className="border-b border-blue-500/30 pb-6">
        <p className="text-xl leading-relaxed text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">
          Dedicated to advancing individual sovereignty through cryptography.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
           <h3 className="text-blue-400 uppercase tracking-widest text-xs mb-3 border-l-2 border-blue-500 pl-2">Core Beliefs</h3>
           <ul className="space-y-3 text-sm">
             {[
               "Financial freedom from centralized authority",
               "Data ownership and privacy as fundamental rights",
               "Time is our scarcest asset",
               "Critical thinking and AI literacy are the major skills you'll need to thrive",
               "Tools should be open and accessible to all"
             ].map((belief, i) => (
               <li key={i} className="flex items-start">
                 <span className="mr-2 text-blue-500">▶</span>
                 <span className="text-blue-100/90">{belief}</span>
               </li>
             ))}
           </ul>
        </div>
        <div>
           <h3 className="text-blue-400 uppercase tracking-widest text-xs mb-3 border-l-2 border-blue-500 pl-2">Current Objectives</h3>
           <ul className="space-y-3 text-sm">
             {[
               "Building open source tools",
               "Leveraging AI and automation to win back time",
               "Promoting Bitcoin adoption and freedom technologies",
               "Prioritizing long-term value creation over short-term gains",
             ].map((goal, i) => (
               <li key={i} className="flex items-start">
                 <span className="mr-2 text-blue-500">◉</span>
                 <span className="text-blue-100/90">{goal}</span>
               </li>
             ))}
           </ul>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-blue-200/80">
        After a decade in traditional finance, I saw the limitations of centralized institutions firsthand. My time is now dedicated to building the alternatives that prioritize individual freedom, ensuring users retain control over their assets and digital lives.
      </p>
    </div>
  );

  const renderInvestmentTable = () => (
    <div className="bg-black/40 border border-blue-500/20">
      <table className="w-full text-left">
        <thead className="bg-blue-900/20 text-blue-300 text-xs uppercase tracking-wider font-mono">
          <tr>
            <th className="p-4">Asset</th>
            <th className="p-4">Stage / Type</th>
            <th className="p-4 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-blue-500/10 font-mono text-sm">
          {INVESTMENT_DATA.map((inv, i) => (
            <tr key={i} className="hover:bg-blue-900/10 transition-colors" onMouseEnter={() => soundManager.playHover()}>
              <td className="p-4">
                <div className="text-white font-bold">{inv.asset}</div>
                {inv.ticker && <div className="text-xs text-blue-500">{inv.ticker}</div>}
              </td>
              <td className="p-4 text-blue-200">{inv.type}</td>
              <td className="p-4 text-right">
                <span className={`px-2 py-1 rounded text-xs ${
                  inv.status === 'Active' ? 'bg-green-900/30 text-green-400' :
                  inv.status === 'Acquired' ? 'bg-purple-900/30 text-purple-400' :
                  inv.status === 'Exited' ? 'bg-red-900/30 text-red-400' :
                  'bg-gray-800 text-gray-400'
                }`}>
                  {inv.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderPortfolio = () => (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex items-center space-x-8 mb-8 border-b border-blue-500/30 px-2">
        <button
          onClick={() => handleTabChange('projects')}
          className={`flex items-center space-x-2 pb-3 transition-all duration-300 ${
            portfolioTab === 'projects' 
              ? 'text-white border-b-2 border-blue-400 ps2-text-shadow' 
              : 'text-blue-500/50 hover:text-blue-300'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span className="uppercase tracking-widest text-sm font-bold">Projects</span>
        </button>
        <button
          onClick={() => handleTabChange('investments')}
          className={`flex items-center space-x-2 pb-3 transition-all duration-300 ${
            portfolioTab === 'investments' 
              ? 'text-white border-b-2 border-blue-400 ps2-text-shadow' 
              : 'text-blue-500/50 hover:text-blue-300'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span className="uppercase tracking-widest text-sm font-bold">Investments</span>
        </button>
      </div>

      {/* Content Area */}
      <motion.div 
        key={portfolioTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-grow overflow-auto ps2-scroll"
      >
        {portfolioTab === 'projects' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PORTFOLIO_DATA.map((item, i) => (
              <div 
                  key={i} 
                  className="bg-black/40 border border-blue-500/30 p-5 flex flex-col h-full hover:border-blue-400 transition-colors relative group"
                  onMouseEnter={() => soundManager.playHover()}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col">
                    <h3 className="text-xl font-bold text-white ps2-text-shadow flex items-center gap-2">
                        {item.title}
                        {item.url && (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-white transition-colors">
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        )}
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-blue-400 border border-blue-500/50 px-2 py-0.5 rounded shrink-0 ml-2">{item.year}</span>
                </div>
                <p className="text-sm text-blue-100 mb-4 flex-grow">{item.description}</p>
                <div className="space-y-2">
                  <div className="text-xs uppercase text-blue-500 tracking-wider">Role: {item.role}</div>
                  <div className="flex flex-wrap gap-2">
                    {item.tech.map(t => (
                      <span key={t} className="text-xs bg-blue-900/50 text-blue-200 px-2 py-1 rounded-sm">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-10" aria-label={`View ${item.title}`} onClick={() => window.umami?.track('portfolio-project-click', { title: item.title })}></a>
                )}
              </div>
            ))}
          </div>
        ) : (
          renderInvestmentTable()
        )}
      </motion.div>
    </div>
  );

  const renderBooks = () => (
    <div className="flex items-center justify-center h-full">
      {BOOK_DATA.map((book, i) => {
        const handleOpen = () => {
          if (book.url) {
            window.umami?.track('book-purchase-click', { title: book.title });
            window.open(book.url, '_blank', 'noopener,noreferrer');
          }
        };
        return (
          <div
            key={i}
            className="max-w-4xl w-full flex flex-col md:flex-row gap-12 items-center bg-black/40 p-12 border border-blue-500/30 rounded-lg"
            onMouseEnter={() => soundManager.playHover()}
            onKeyDown={(e) => { if (e.key === 'Enter') handleOpen(); }}
            tabIndex={book.url ? 0 : undefined}
          >
            <div
              className={`w-48 h-72 shrink-0 ${book.coverImage ? '' : book.coverColor} shadow-[0_0_30px_rgba(234,88,12,0.3)] flex items-center justify-center text-center border-2 border-white/10 rotate-[-2deg] overflow-hidden ${book.url ? 'cursor-pointer' : ''}`}
              onClick={handleOpen}
            >
              {book.coverImage ? (
                <img src={book.coverImage} alt={book.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full p-4 border border-white/20 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-white/90 uppercase tracking-widest font-serif">{book.title}</span>
                  <span className="mt-4 text-xs text-white/70 uppercase tracking-widest">{book.author}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-center md:items-start text-center md:text-left">
              <h3 className="text-4xl font-serif text-white mb-1">{book.title}</h3>
              {book.subtitle && <p className="text-sm text-white/40 uppercase tracking-widest mb-3 font-mono">{book.subtitle}</p>}
              <div className="text-xl text-blue-400 mb-6">{book.author}</div>

              <div className="bg-blue-900/30 border border-blue-500/50 px-6 py-4 rounded mb-6">
                <p className="text-base text-blue-100 italic leading-relaxed">"{book.thoughts}"</p>
              </div>

              <div className="flex items-center space-x-2 mb-6">
                <span className="uppercase tracking-widest text-sm font-bold text-white/50">Available Now</span>
                <span className="h-px w-8 bg-blue-500/50"></span>
                <span className="font-mono text-green-400">Bitcoin Magazine Books</span>
              </div>

              {book.url && (
                <button
                  onClick={handleOpen}
                  className="uppercase tracking-widest text-sm font-bold text-blue-400 border border-blue-500/50 px-6 py-2 rounded hover:bg-blue-500/20 transition-colors"
                >
                  Get the Book →
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderEssays = () => {
    if (selectedEssay) {
       return (
         <div className="max-w-3xl mx-auto font-mono text-blue-100">
             {/* Header */}
             <div className="border-b border-blue-500/30 pb-4 mb-6 pt-2">
                 <h3 className="text-2xl font-bold text-white mb-2 leading-tight">{selectedEssay.title}</h3>
                 <div className="flex items-center space-x-4 text-xs text-blue-400 font-mono">
                    <span>{selectedEssay.date}</span>
                    <span className="text-blue-600">//</span>
                    <span>{selectedEssay.readTime} read</span>
                 </div>
                 {selectedEssay.sourceUrl && (
                   <a
                     href={selectedEssay.sourceUrl}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="inline-block mt-2 text-xs text-blue-400 font-mono hover:text-white underline underline-offset-2"
                   >
                     {selectedEssay.sourceLabel || 'Published elsewhere'}
                   </a>
                 )}
             </div>

             {/* Content - preserving whitespace, with **bold**, links, and Substack media */}
             <div className="leading-relaxed opacity-90 text-sm md:text-base font-light text-blue-50 pb-8">
                 <EssayBody content={selectedEssay.content} />
             </div>
         </div>
       );
    }

    return (
        <div className="space-y-8">
          {ESSAY_DATA.map((post, i) => (
            <article
                key={i}
                className="group cursor-pointer bg-blue-900/10 border border-transparent hover:border-blue-500/30 p-6 rounded transition-all duration-300"
                onMouseEnter={() => {
                  soundManager.playHover();
                  hapticManager.light();
                }}
                onClick={() => {
                    soundManager.playSelect();
                    hapticManager.medium();
                    setSelectedEssay(post);
                }}
            >
              <div className="flex items-baseline justify-between mb-2 border-b border-blue-500/30 pb-2">
                <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors ps2-text-shadow">{post.title}</h3>
                <span className="font-mono text-xs text-blue-500">{post.date}</span>
              </div>
              <p className="text-blue-200 mb-4 font-light leading-relaxed">{post.excerpt}</p>
              <div className="flex items-center text-xs text-blue-400 font-mono uppercase tracking-wider group-hover:text-white transition-colors">
                <span>OPEN FILE</span>
                <span className="mx-2">::</span>
                <span>{post.readTime} READ</span>
              </div>
              {post.sourceUrl && (
                <a
                  href={post.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="inline-block mt-3 text-xs text-blue-400 font-mono normal-case tracking-normal hover:text-white underline underline-offset-2"
                >
                  {post.sourceLabel || 'Published elsewhere'}
                </a>
              )}
            </article>
          ))}
        </div>
    );
  };

  const renderContentTabs = () => (
    <div className="shrink-0 border-b border-blue-500/30 px-3 md:px-6 bg-[#050a14] overflow-hidden">
      <div className="flex w-full items-end">
        {CONTENT_TABS.map(tab => {
          const Icon = tab.icon;
          const active = contentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleContentTabChange(tab.id)}
              className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 md:gap-2 px-1 pb-3 pt-3 transition-all duration-300 border-b-2 -mb-px ${
                active
                  ? 'text-white border-blue-400 ps2-text-shadow'
                  : 'text-blue-400/70 border-transparent hover:text-blue-200'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="uppercase tracking-widest text-[11px] md:text-sm font-bold leading-none truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderContentHub = () => (
    <motion.div
      key={selectedEssay ? selectedEssay.slug : contentTab}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {contentTab === 'essays' && renderEssays()}
      {contentTab === 'posts' && (
        <div className="space-y-4">
          <p className="text-blue-400/80 text-xs font-mono uppercase tracking-widest">
            Top posts by engagement · {RANKED_POSTS.length} from @BTCBap
          </p>
          {RANKED_POSTS.map(item => renderPostCard(item))}
        </div>
      )}
      {contentTab === 'podcasts' && (
        <div className="space-y-10">
          <div>
            <h3 className="text-blue-400 uppercase tracking-widest text-xs mb-4 border-l-2 border-blue-500 pl-2">
              Value Stack (host)
            </h3>
            <div className="space-y-4">
              {PODCASTS_VALUE_STACK.map(item => renderMediaCard(item))}
            </div>
          </div>
          <div>
            <h3 className="text-blue-400 uppercase tracking-widest text-xs mb-4 border-l-2 border-blue-500 pl-2">
              Guest appearances
            </h3>
            <div className="space-y-4">
              {PODCASTS_APPEARANCES.map(item => renderMediaCard(item))}
            </div>
          </div>
        </div>
      )}
      {contentTab === 'lectures' && (
        <div className="space-y-4">
          {LECTURES.map(item => renderMediaCard(item))}
        </div>
      )}
      {contentTab === 'tutorials' && (
        <div className="space-y-4">
          {TUTORIALS.map(item => renderMediaCard(item))}
        </div>
      )}
      {contentTab === 'reading' && (
        <div className="space-y-4">
          {READING_LIST.map(item => renderReadingCard(item))}
        </div>
      )}
    </motion.div>
  );

  const renderWork = () => (
    <div className="space-y-4 max-w-4xl mx-auto">
       <div className="flex justify-between items-center text-xs uppercase tracking-widest text-blue-500/60 border-b border-blue-500/20 pb-2 mb-4">
         <span>Organization</span>
         <span>Duration</span>
       </div>
      {WORK_DATA.map((job, i) => (
        <div 
          key={i} 
          className="group relative bg-blue-900/10 border border-blue-500/10 hover:border-blue-500/40 p-5 rounded-sm transition-all duration-300"
          onMouseEnter={() => soundManager.playHover()}
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-2">
            <div>
               <h3 className="text-xl font-bold text-white group-hover:text-blue-200 transition-colors">{job.company}</h3>
               {job.subRoles ? (
                 <div className="mt-2 space-y-1 pl-4 border-l border-blue-500/30">
                   {job.subRoles.map((role, idx) => (
                      <div key={idx} className="text-sm">
                         <span className="text-blue-300 font-medium">{role.title}</span>
                         <span className="text-blue-500/50 mx-2">|</span>
                         <span className="text-blue-400/70 text-xs font-mono">{role.period}</span>
                      </div>
                   ))}
                 </div>
               ) : (
                 <div className="text-blue-300 font-medium mt-1">{job.role}</div>
               )}
            </div>
            <div className="text-right mt-2 md:mt-0">
               <div className="font-mono text-sm text-blue-400">{job.period}</div>
               <div className="text-xs uppercase tracking-widest text-blue-600 mt-1">{job.location}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const getContent = () => {
    switch (section.id) {
      case 'social': return renderSocials();
      case 'about': return renderAbout();
      case 'portfolio': return renderPortfolio();
      case 'book': return renderBooks();
      case 'content': return renderContentHub();
      case 'work': return renderWork();
      default: return <div>Under Construction</div>;
    }
  };

  return (
    <motion.div 
      className="fixed inset-0 z-50 flex items-stretch justify-center p-4 md:p-12 bg-black/80 backdrop-blur-md"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <style>{scrollbarStyles}</style>
      <div className="w-full max-w-5xl h-full min-h-0 flex flex-col border border-blue-500/30 rounded-lg overflow-hidden bg-[#050a14] shadow-[0_0_50px_rgba(0,50,255,0.15)]">
        
        {/* Header */}
        <div className="shrink-0 h-16 border-b border-blue-500/30 flex items-center justify-between px-6 bg-gradient-to-r from-blue-900/20 to-transparent overflow-hidden">
          <div className="flex items-center space-x-4">
            <section.icon className="w-6 h-6 text-blue-400" />
            <h2 className="text-2xl font-bold tracking-widest uppercase text-white ps2-text-shadow">
              {section.title}
            </h2>
          </div>
        </div>

        {section.id === 'content' && renderContentTabs()}

        {/* Content Body */}
        <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 md:p-10 relative ps2-scroll">
          {getContent()}
        </div>

        {/* Footer Controls */}
        <div className="shrink-0 border-t border-blue-500/30 flex items-center px-6 py-4 bg-black/40 text-sm">
          <button 
            onClick={handleBack}
            className="flex items-center space-x-2 text-blue-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="uppercase tracking-widest font-mono text-xs">
              {selectedEssay ? "Return to List" : "Back to Home"}
            </span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ContentScreen;