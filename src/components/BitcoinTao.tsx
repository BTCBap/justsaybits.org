import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { bitcoinTaoChapters } from '../constants';
import { Chapter } from '../types';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

const BitcoinTao: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const currentChapter: Chapter = bitcoinTaoChapters[currentIndex];

  const navigateChapter = useCallback((step: number) => {
    setDirection(step);
    setCurrentIndex((prevIndex) => {
      const newIndex = prevIndex + step;
      if (newIndex < 0) return bitcoinTaoChapters.length - 1;
      if (newIndex >= bitcoinTaoChapters.length) return 0;
      return newIndex;
    });
  }, []);

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeThreshold = 50; // pixels
    if (info.offset.x < -swipeThreshold) {
      navigateChapter(1); // Swiped left for next chapter
    } else if (info.offset.x > swipeThreshold) {
      navigateChapter(-1); // Swiped right for previous chapter
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full text-center relative p-4">
       <h1 className="text-3xl font-bold mb-8 text-light-text dark:text-dark-text">
        The Bitcoin Tao
      </h1>
      <div className="relative w-full max-w-3xl h-[70vh] sm:h-[65vh] md:h-[60vh] flex items-center justify-center">
        <button
          onClick={() => navigateChapter(-1)}
          className="absolute -left-6 top-1/2 -translate-y-1/2 z-10 p-2 bg-light-card dark:bg-dark-card rounded-full shadow-md text-light-accent dark:text-dark-accent hover:bg-opacity-80 transition-all"
          aria-label="Previous chapter"
        >
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="w-full h-full px-6 sm:px-10 md:px-12 pt-4 pb-6 sm:pt-6 sm:pb-8 md:pt-6 md:pb-8 bg-light-card dark:bg-dark-card rounded-xl shadow-xl flex flex-col items-center justify-start cursor-grab active:cursor-grabbing"
          >
            <h2 className="text-2xl font-semibold mb-6 text-light-accent dark:text-dark-accent pointer-events-none">
              {currentChapter.title}
            </h2>
            <div className="text-base text-left text-light-text dark:text-dark-text overflow-y-auto max-h-[calc(100%-3.5rem)] pr-2 w-full touch-pan-y">
              {currentChapter.content.map((line, index) => (
                <p key={index}>{line || <br />}</p>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        <button
          onClick={() => navigateChapter(1)}
          className="absolute -right-6 top-1/2 -translate-y-1/2 z-10 p-2 bg-light-card dark:bg-dark-card rounded-full shadow-md text-light-accent dark:text-dark-accent hover:bg-opacity-80 transition-all"
          aria-label="Next chapter"
        >
          <ChevronRightIcon className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default BitcoinTao;