
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from './components/Header';
import Drawer from './components/Drawer';
import HomeCard from './components/HomeCard';
import BitcoinTao from './components/BitcoinTao';
import AboutSection from './components/AboutSection';
import { Theme, View } from './types';
import ThemeToggle from './components/ThemeToggle';
import MusicPlayer from './components/MusicPlayer';

const App: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(Theme.DARK);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentView, setCurrentView] = useState<View>(View.HOME);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    if (storedTheme && Object.values(Theme).includes(storedTheme)) {
      setTheme(storedTheme);
    } else {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme(Theme.DARK);
      } else {
        setTheme(Theme.LIGHT);
      }
    }
  }, []);

  useEffect(() => {
    if (theme === Theme.DARK) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => prevTheme === Theme.LIGHT ? Theme.DARK : Theme.LIGHT);
  }, []);

  const toggleDrawer = useCallback(() => {
    setIsDrawerOpen(prev => !prev);
  }, []);

  const navigateTo = useCallback((view: View) => {
    setCurrentView(view);
    setIsDrawerOpen(false);
  }, []);
  
  const toggleMusic = useCallback(() => {
    setIsMusicPlaying(prev => !prev);
  }, []);

  const renderView = () => {
    switch (currentView) {
      case View.HOME:
        return <HomeCard navigateTo={navigateTo} />;
      case View.ABOUT:
        return <AboutSection navigateTo={navigateTo}/>;
      case View.BOOK:
        return <BitcoinTao />;
      case View.DENVER_BITDEVS:
      case View.THE_SPACE:
      case View.PODCAST:
      case View.CONTACT:
        return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <h2 className="text-3xl font-bold mb-4 text-light-accent dark:text-dark-accent">
              {currentView.charAt(0).toUpperCase() + currentView.slice(1).replace('_', ' ')}
            </h2>
            <p className="text-lg text-light-text dark:text-dark-text">This section is under construction or an external link.</p>
          </div>
        );
      default:
        return <HomeCard navigateTo={navigateTo} />;
    }
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${theme === Theme.DARK ? 'bg-dark-bg text-dark-text' : 'bg-light-bg text-light-text'}`}>
      <Header 
        onToggleDrawer={toggleDrawer} 
        onToggleMusic={toggleMusic}
        isMusicPlaying={isMusicPlaying}
      />
      <Drawer isOpen={isDrawerOpen} onClose={toggleDrawer} navigateTo={navigateTo} currentView={currentView} />
      
      <main className="flex-grow flex items-center justify-center p-4 pt-20 sm:pt-24 md:pt-28 relative overflow-hidden"> {/* Increased top padding for header */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full flex items-center justify-center"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>
      
      <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      <MusicPlayer isPlaying={isMusicPlaying} />

      <audio id="background-audio" loop src="/audio/wanted_outlaw.mp3" preload="metadata"></audio>
    </div>
  );
};

export default App;