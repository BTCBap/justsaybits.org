import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NAV_ITEMS } from '../constants';
import { View } from '../types';
import { XMarkIcon } from './icons';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  navigateTo: (view: View) => void;
  currentView: View;
}

const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, navigateTo, currentView }) => {
  const backdropVariants = {
    open: { opacity: 1, pointerEvents: 'auto' as 'auto' },
    closed: { opacity: 0, pointerEvents: 'none' as 'none'},
  };

  const drawerVariants = {
    open: { x: 0 },
    closed: { x: '100%' },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            variants={backdropVariants}
            initial="closed"
            animate="open"
            exit="closed"
            onClick={onClose}
            transition={{ duration: 0.3 }}
          />
          <motion.div
            className="fixed top-0 right-0 h-full w-64 sm:w-80 bg-light-bg dark:bg-dark-bg shadow-lg z-50 p-6 flex flex-col"
            variants={drawerVariants}
            initial="closed"
            animate="open"
            exit="closed"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="flex justify-end mb-8">
              <button
                onClick={onClose}
                className="p-2 rounded-full text-light-text dark:text-dark-text hover:bg-light-text/10 dark:hover:bg-dark-text/10 transition-colors"
                aria-label="Close navigation menu"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <nav>
              <ul>
                {NAV_ITEMS.map((item) => (
                  <li key={item.label} className="mb-1">
                    {item.href ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onClose} // Close drawer when external link is clicked
                        className={`block w-full text-left py-3 px-4 rounded-md text-xl transition-all duration-200 ease-in-out text-light-text dark:text-dark-text hover:bg-light-text/5 dark:hover:bg-dark-text/5 hover:pl-6`}
                      >
                        {item.label}
                      </a>
                    ) : (
                      <button
                        onClick={() => navigateTo(item.view)} // navigateTo in App.tsx handles closing the drawer
                        className={`w-full text-left py-3 px-4 rounded-md text-xl transition-all duration-200 ease-in-out
                          ${currentView === item.view 
                            ? 'bg-light-accent/20 text-light-accent dark:bg-dark-accent/20 dark:text-dark-accent font-semibold' 
                            : 'text-light-text dark:text-dark-text hover:bg-light-text/5 dark:hover:bg-dark-text/5 hover:pl-6'
                          }`}
                      >
                        {item.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Drawer;
