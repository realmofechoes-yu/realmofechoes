import { createContext, useContext, useState, useEffect, useRef } from 'react';

const AudioContext = createContext(null);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudio must be used within an AudioProvider');
  return context;
};

export const AudioProvider = ({ children }) => {
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('roe_muted') === 'true';
  });
  const [currentTrack, setCurrentTrack] = useState(null);
  
  const audioRef = useRef(null);

  useEffect(() => {
    // Initialize audio object once
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = true;
      // Background music should not be too loud by default
      audioRef.current.volume = isMuted ? 0 : 0.3; 
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : 0.3;
      localStorage.setItem('roe_muted', isMuted);
    }
  }, [isMuted]);

  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };

  const playTrack = (filename) => {
    if (!audioRef.current) return;
    
    // Prevent restarting the same track if already playing
    if (currentTrack === filename) return;
    
    setCurrentTrack(filename);
    audioRef.current.src = `/audio/${filename}`;
    
    // Play with catch to ignore auto-play policies when user hasn't interacted yet
    audioRef.current.play().catch(err => {
      console.warn("Audio autoplay prevented by browser. It will play when the user interacts.", err);
    });
  };

  return (
    <AudioContext.Provider value={{ isMuted, toggleMute, playTrack, currentTrack }}>
      {children}
    </AudioContext.Provider>
  );
};
