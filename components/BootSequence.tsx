import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { soundManager } from '../utils/SoundManager';

interface BootSequenceProps {
  onComplete: () => void;
}

const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<'intro' | 'fadeout'>('intro');

  useEffect(() => {
    try {
        soundManager.playBoot();
    } catch (e) {
        // Silently fail if autoplay blocked
    }

    const endTimer = setTimeout(() => {
      setStage('fadeout');
      setTimeout(onComplete, 1500); 
    }, 4000);

    return () => {
      clearTimeout(endTimer);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden">
      
      <AnimatePresence>
        {stage === 'intro' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 1.5 } }}
            className="absolute inset-0 w-full h-full"
          >
            {/* Background Void - slightly lighter to contrast deeply with black elements if needed */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a1020] via-[#000] to-[#0a1020]" />

            {/* Simulating the PS2 "Towers" (Save Blocks) rising from mist */}
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                {[...Array(25)].map((_, i) => {
                    const randomHeight = 80 + Math.random() * 250;
                    const randomWidth = 20 + Math.random() * 40;
                    const randomX = (Math.random() - 0.5) * 120; // Spread wider
                    const randomDelay = Math.random() * 1.5;
                    const duration = 3 + Math.random() * 3;
                    
                    return (
                        <motion.div 
                            key={i}
                            initial={{ 
                                opacity: 0, 
                                y: '120vh', 
                                scale: 0.2 + (Math.random() * 0.5),
                                x: 0
                            }}
                            animate={{ 
                                opacity: [0, 0.4, 0.7, 0], 
                                y: '-120vh', 
                                scale: 1 + (Math.random() * 0.5),
                            }}
                            transition={{ 
                                duration: duration, 
                                delay: randomDelay,
                                ease: [0.4, 0, 0.2, 1] // Dynamic ease-in-out
                            }}
                            className="absolute bg-gradient-to-t from-transparent via-blue-500/40 to-blue-300/5 border-x border-blue-400/20"
                            style={{
                                height: `${randomHeight}px`,
                                width: `${randomWidth}px`,
                                left: `${50 + randomX}%`,
                                filter: `blur(${Math.random() * 3}px)`
                            }}
                        />
                    );
                })}
            </div>

            {/* Ethereal Clouds */}
            <motion.div 
               initial={{ opacity: 0, scale: 0.8 }}
               animate={{ opacity: [0, 1, 0], scale: 1.2 }}
               transition={{ duration: 4.5, ease: "easeInOut" }}
               className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
               <div className="w-[600px] h-[600px] bg-blue-600/20 blur-[120px] rounded-full" />
               <div className="absolute w-[400px] h-[400px] bg-purple-600/10 blur-[90px] rounded-full mix-blend-screen" />
            </motion.div>

            {/* Central pulsing light source */}
            <div className="absolute inset-0 flex items-center justify-center">
                 <motion.div 
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ 
                        opacity: [0, 1, 0.6, 0.8, 0],
                        scale: [0.5, 1.2, 1, 1.5, 2.5]
                    }}
                    transition={{ duration: 4, ease: "easeInOut" }}
                    className="w-3 h-3 bg-white blur-[3px] rounded-full shadow-[0_0_120px_rgba(200,220,255,1)]"
                 />
                 {/* Secondary expanding shockwave */}
                 <motion.div 
                    initial={{ opacity: 0, scale: 0.8, borderWidth: "1px" }}
                    animate={{ 
                        opacity: [0, 0.4, 0],
                        scale: [0.8, 2, 4],
                        borderWidth: ["1px", "4px", "0px"]
                    }}
                    transition={{ duration: 3.5, delay: 0.3, ease: "easeOut" }}
                    className="absolute w-24 h-24 border border-blue-300/30 rounded-full blur-md"
                 />
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BootSequence;