import React from 'react';
import { motion } from 'framer-motion';
import { SunIcon, MoonIcon } from './icons';
import { Theme } from '../types';

interface ThemeToggleProps {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, toggleTheme }) => {
  return (
    <motion.button
      onClick={toggleTheme}
      className="fixed bottom-4 left-4 z-50 p-3 rounded-full bg-light-card dark:bg-dark-card shadow-lg text-light-accent dark:text-dark-accent hover:scale-110 transition-transform"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      aria-label={theme === Theme.LIGHT ? "Switch to dark mode" : "Switch to light mode"}
    >
      {theme === Theme.LIGHT ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
    </motion.button>
  );
};

export default ThemeToggle;
