import React from 'react';
import { View } from '../types';

interface HomeCardButton {
  label: string;
  view: View;
  isExternal?: boolean;
  href?: string;
}

interface HomeCardProps {
  navigateTo: (view: View) => void;
}

const HomeCard: React.FC<HomeCardProps> = ({ navigateTo }) => {
  const cardButtons: HomeCardButton[] = [
    { label: 'About', view: View.ABOUT },
    { label: 'Book', view: View.BOOK },
  ];

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-lg p-6">
      <div className="bg-light-card dark:bg-dark-card p-10 rounded-xl shadow-2xl text-center w-full">
        <img
          src="/images/cypher1.jpg"
          alt="BTCBap"
          className="w-32 h-32 sm:w-40 sm:h-40 rounded-full mx-auto mb-6 shadow-md border-2 border-light-accent dark:border-dark-accent object-cover" /* Increased w-24 h-24 to w-32 h-32, sm:w-32 sm:h-32 to sm:w-40 sm:h-40, mb-4 to mb-6 */
        />
        <p className="text-2xl mb-8 text-light-text dark:text-dark-text">
          &infin; / 21M
        </p>
        <div className="grid grid-cols-2 gap-4">
          {cardButtons.map(button => (
            button.isExternal && button.href ? (
              <a
                key={button.label}
                href={button.href}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-5 bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text rounded-lg hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 hover:text-light-accent dark:hover:text-dark-accent transition-all duration-200 shadow-sm text-base sm:text-lg flex items-center justify-center"
              >
                {button.label}
              </a>
            ) : (
              <button
                key={button.label}
                onClick={() => navigateTo(button.view)}
                className="py-3 px-5 bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text rounded-lg hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 hover:text-light-accent dark:hover:text-dark-accent transition-all duration-200 shadow-sm text-base sm:text-lg"
              >
                {button.label}
              </button>
            )
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomeCard;