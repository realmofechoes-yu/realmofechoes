import { useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '../../context/GameContext';

export default function ActiveSessionBanner() {
  const { coopSessionId, coopCharacterId } = useGame();
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show if no session or if we're already on a multiplayer game page
  if (!coopSessionId || location.pathname.includes('/multiplayer/')) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-primary/90 to-purple-900/90 backdrop-blur-md border-b border-primary/30 py-3 px-6 flex items-center justify-between shadow-glow-primary animate-slide-down sticky top-16 z-40">
      <div className="flex items-center gap-3">
        <span className="text-xl animate-pulse">⚔️</span>
        <div className="flex flex-col md:flex-row md:items-center md:gap-4">
          <span className="font-title font-bold text-white tracking-wide">Active Co-Op Session</span>
          <span className="text-xs text-purple-200 font-serif italic hidden md:block">"Your allies are waiting in the depths..."</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <button 
          onClick={() => {
            // Going to dungeon page will handle the redirect to combat if active
            navigate(`/multiplayer/dungeon/${coopCharacterId}/${coopSessionId}`);
          }}
          className="btn btn-arcane !py-1.5 !px-5 !text-xs font-bold uppercase tracking-widest shadow-glow-primary hover:scale-105 transition-transform"
        >
          Resume Session
        </button>
      </div>
    </div>
  );
}
