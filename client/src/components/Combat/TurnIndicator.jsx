import { useState, useEffect } from 'react';
import './TurnIndicator.css';

export default function TurnIndicator({ isMyTurn, activeUsername, timeLimit = 30, turnStartedAt }) {
  const [timeLeft, setTimeLeft] = useState(timeLimit);

  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!turnStartedAt) return timeLimit;
      const elapsed = Math.floor((Date.now() - turnStartedAt) / 1000);
      return Math.max(0, timeLimit - elapsed);
    };

    setTimeLeft(calculateTimeLeft());
    
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isMyTurn, activeUsername, timeLimit, turnStartedAt]);

  const pct = (timeLeft / timeLimit) * 100;
  const urgent = timeLeft <= 10;

  return (
    <div className={`turn-indicator ${isMyTurn ? 'my-turn' : ''} ${urgent ? 'urgent' : ''}`}>
      <div className="turn-label">
        {isMyTurn ? (
          <span className="turn-text-mine">🎯 YOUR TURN!</span>
        ) : (
          <span className="turn-text-other">⏳ {activeUsername}'s Turn</span>
        )}
      </div>
      <div className="turn-timer-bar">
        <div className="turn-timer-fill" style={{ width: `${pct}%` }}></div>
      </div>
      <span className="turn-timer-text">{timeLeft}s</span>
    </div>
  );
}
