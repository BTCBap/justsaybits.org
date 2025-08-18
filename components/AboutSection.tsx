import React from 'react';
import { View } from '../types';

interface AboutProps {
  navigateTo: (view: View) => void;
}

const AboutSection: React.FC<AboutProps> = ({ navigateTo }) => {
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-3xl p-4 sm:p-8 text-center">
      <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-light-accent dark:text-dark-accent">
        About Me
      </h1>
      <div className="text-lg text-light-text dark:text-dark-text">
        <p>Built with no goal, updated when it’s time.</p>
        <p>If you seek inspiration, <button className="hover:text-dark-accent" onClick={() => navigateTo(View.BOOK)}>The Bitcoin Tao</button> tab is waiting.</p>
        <p className=" mb-8">Go visit The Space in Denver.</p>
      </div>
      <div className="flex flex-col md:flex-row items-center md:items-start md:space-x-6">
        <img 
          src="images/bitcoinzen.jpg"
          alt="The Bitcoin Zen-ist" 
          className="w-96 h-auto md:w-96 rounded-lg mb-6 md:mb-0 shadow-md object-cover"
        />
      </div>
    </div>
  );
};

export default AboutSection;
