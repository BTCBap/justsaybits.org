import React from 'react';
import { PlayIcon, Bars3Icon, PauseIcon } from './icons';

interface HeaderProps {
  onToggleDrawer: () => void;
  onToggleMusic: () => void;
  isMusicPlaying: boolean;
}

const Header: React.FC<HeaderProps> = ({ onToggleDrawer, onToggleMusic, isMusicPlaying }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between p-4 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-md shadow-md">
      <button
        onClick={onToggleMusic}
        className="p-2 rounded-full text-light-accent dark:text-dark-accent hover:bg-light-text/10 dark:hover:bg-dark-text/10 transition-colors"
        aria-label={isMusicPlaying ? "Pause music" : "Play music"}
      >
        {isMusicPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
      </button>
      <button
        onClick={onToggleDrawer}
        className="p-2 rounded-full text-light-accent dark:text-dark-accent hover:bg-light-text/10 dark:hover:bg-dark-text/10 transition-colors"
        aria-label="Toggle navigation menu"
      >
        <Bars3Icon className="w-6 h-6" />
      </button>
    </header>
  );
};

export default Header;
