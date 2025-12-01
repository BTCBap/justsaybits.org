import React, { useState, useEffect } from 'react';
import { motion, Variants } from 'framer-motion';
import { ArrowLeft, LayoutGrid, TrendingUp, ExternalLink } from 'lucide-react';
import {
  PORTFOLIO_DATA,
  INVESTMENT_DATA,
  BOOK_DATA,
  WRITING_DATA,
  WORK_DATA,
  SOCIAL_LINKS
} from '../constants';
import { Section, WritingItem } from '../types';
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
  }
`;

const ContentScreen: React.FC<ContentScreenProps> = ({ section, onBack }) => {
  const [portfolioTab, setPortfolioTab] = useState<'projects' | 'investments'>('projects');
  const [selectedWriting, setSelectedWriting] = useState<WritingItem | null>(null);

  const handleBack = () => {
    soundManager.playBack();
    hapticManager.medium();
    if (selectedWriting) {
      setSelectedWriting(null);
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
  }, [selectedWriting, onBack]);

  const handleTabChange = (tab: 'projects' | 'investments') => {
    if (portfolioTab !== tab) {
      soundManager.playHover();
      hapticManager.light();
      setPortfolioTab(tab);
    }
  };

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
          onClick={() => hapticManager.medium()}
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
      <div className="border-b border-blue-500/30 pb-6">
        <h3 className="text-blue-400 uppercase tracking-widest text-sm mb-4 font-bold">Mission Directive</h3>
        <p className="text-xl leading-relaxed text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">
          Dedicated to advancing individual sovereignty through cryptography. </p>
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

      <div className="bg-blue-900/10 border border-blue-500/20 p-6 rounded-sm mt-8">
         <h3 className="text-blue-400 uppercase tracking-widest text-xs mb-2">Log Entry: Background</h3>
         <p className="text-sm leading-relaxed text-blue-200/80 font-mono">
            After a decade in traditional finance, I saw the limitations of centralized institutions firsthand. My time is now dedicated to building the alternatives that prioritize individual freedom, ensuring users retain control over their assets and digital lives.
         </p>
      </div>

      <div className="mt-8 border-t border-blue-500/30 pt-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]" />
          <span className="font-mono text-xs text-green-400/80 uppercase tracking-wider">System Status: Sovereign</span>
        </div>
      </div>
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
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-10" aria-label={`View ${item.title}`}></a>
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
      {BOOK_DATA.map((book, i) => (
        <div key={i} className="max-w-4xl w-full flex flex-col md:flex-row gap-12 items-center bg-black/40 p-12 border border-blue-500/30 rounded-lg" onMouseEnter={() => soundManager.playHover()}>
          <div className={`w-48 h-72 shrink-0 ${book.coverColor} shadow-[0_0_30px_rgba(234,88,12,0.3)] flex items-center justify-center text-center p-4 border-2 border-white/10 rotate-[-2deg]`}>
            <div className="w-full h-full border border-white/20 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-white/90 uppercase tracking-widest font-serif">{book.title}</span>
                <span className="mt-4 text-xs text-white/70 uppercase tracking-widest">{book.author}</span>
            </div>
          </div>
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <h3 className="text-4xl font-serif text-white mb-2">{book.title}</h3>
            <div className="text-xl text-blue-400 mb-6">{book.author}</div>
            
            <div className="bg-blue-900/30 border border-blue-500/50 px-6 py-4 rounded mb-6">
                <p className="text-lg text-blue-100 italic">"{book.thoughts}"</p>
            </div>
            
            <div className="flex items-center space-x-2 text-yellow-500">
               <span className="uppercase tracking-widest text-sm font-bold text-white/50">Release Date</span>
               <span className="h-px w-8 bg-blue-500/50"></span>
               <span className="font-mono text-white">March 2026</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderWritings = () => {
    if (selectedWriting) {
       return (
         <div className="max-w-3xl mx-auto font-mono text-blue-100 h-full overflow-auto pr-4 ps2-scroll">
             {/* Header */}
             <div className="border-b border-blue-500/30 pb-4 mb-6 sticky top-0 bg-[#050a14] z-10 pt-2">
                 <h3 className="text-2xl font-bold text-white mb-2 uppercase tracking-wide leading-tight">{selectedWriting.title}</h3>
                 <div className="flex items-center space-x-4 text-xs text-blue-400 font-mono">
                    <span>{selectedWriting.date}</span>
                    <span className="text-blue-600">//</span>
                    <span>{selectedWriting.readTime} read</span>
                    <span className="text-blue-600">//</span>
                    <span>{selectedWriting.slug.toUpperCase()}</span>
                 </div>
             </div>
             
             {/* Content - preserving whitespace */}
             <div className="whitespace-pre-wrap leading-relaxed opacity-90 text-sm md:text-base font-light text-blue-50">
                 {selectedWriting.content}
             </div>

             {/* Footer decoration */}
             <div className="mt-12 pt-8 border-t border-blue-500/20 text-center pb-8">
                 <span className="animate-pulse text-blue-500 text-xl">_</span>
             </div>
         </div>
       );
    }

    return (
        <div className="space-y-8">
          {WRITING_DATA.map((post, i) => (
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
                    setSelectedWriting(post);
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
            </article>
          ))}
        </div>
    );
  };

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
      case 'writings': return renderWritings();
      case 'work': return renderWork();
      default: return <div>Under Construction</div>;
    }
  };

  return (
    <motion.div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-12 bg-black/80 backdrop-blur-md"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <style>{scrollbarStyles}</style>
      <div className="w-full max-w-5xl h-full flex flex-col max-h-[90vh] border border-blue-500/30 rounded-lg overflow-hidden bg-[#050a14] shadow-[0_0_50px_rgba(0,50,255,0.15)]">
        
        {/* Header */}
        <div className="h-16 border-b border-blue-500/30 flex items-center justify-between px-6 bg-gradient-to-r from-blue-900/20 to-transparent">
          <div className="flex items-center space-x-4">
            <section.icon className="w-6 h-6 text-blue-400" />
            <h2 className="text-2xl font-bold tracking-widest uppercase text-white ps2-text-shadow">
              {section.title}
            </h2>
          </div>
          <div className="text-xs font-mono text-blue-500/60">
            SYS.VER.2.0 // MEMORY_BLOCK_0{section.id.length}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-grow overflow-auto p-6 md:p-10 relative ps2-scroll">
          {getContent()}
        </div>

        {/* Footer Controls */}
        <div className="h-14 border-t border-blue-500/30 flex items-center px-6 bg-black/40 text-sm">
          <button 
            onClick={handleBack}
            className="flex items-center space-x-2 text-blue-300 hover:text-white transition-colors group"
          >
            <div className="w-6 h-6 rounded-full border border-blue-400 flex items-center justify-center group-hover:bg-blue-500/20">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span className="uppercase tracking-widest font-mono text-xs">
              {selectedWriting ? "Return to List" : "Back to System"}
            </span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ContentScreen;