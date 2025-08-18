import React, { useEffect, useRef } from 'react';

interface MusicPlayerProps {
  isPlaying: boolean;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({ isPlaying }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audioElement = document.getElementById('background-audio') as HTMLAudioElement | null;
    if (audioElement) {
      audioRef.current = audioElement;
    }
  }, []);
  

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(error => console.warn("Audio play interrupted:", error));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);
  return null; 
};

export default MusicPlayer;
