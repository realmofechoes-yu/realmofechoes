import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAudio } from '../context/AudioContext';
import { useGame } from '../context/GameContext';

export default function ModeSelectPage() {
  const { user } = useAuth();
  const { playTrack } = useAudio();
  const navigate = useNavigate();
  const { coopSessionId, coopCharacterId, setLastMode } = useGame();

  useEffect(() => {
    playTrack('journey_begins.mp3');
  }, [playTrack]);

  return (
    <div className="w-full max-w-6xl mx-auto animate-fade-in flex flex-col items-center justify-center min-h-[70vh] py-12">
      {coopSessionId && (
        <div className="w-full max-w-4xl mb-12 animate-slide-up">
          <div className="panel bg-gradient-to-r from-primary/20 to-purple-900/20 border-2 border-primary/50 p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-glow-primary">
            <div className="flex items-center gap-6">
              <div className="text-6xl animate-pulse">⚔️</div>
              <div className="text-left">
                <h3 className="font-title text-2xl font-bold text-white mb-1">Active Co-Op Session Found</h3>
                <p className="text-purple-200 font-serif italic text-sm">You have an ongoing adventure. Your allies need your strength!</p>
              </div>
            </div>
            <button 
              onClick={() => navigate(`/multiplayer/dungeon/${coopCharacterId}/${coopSessionId}`)}
              className="btn btn-arcane !py-4 !px-10 text-lg shadow-glow-primary hover:scale-105 transition-transform"
            >
              Resume Journey
            </button>
          </div>
        </div>
      )}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-title font-bold text-gold drop-shadow-md mb-3 flex items-center justify-center gap-3">
          <span className="text-5xl">⚔️</span> Choose Your Path
        </h2>
        <p className="text-gray-400 font-serif italic text-lg">Welcome back, {user?.username}. Will you brave the dungeon alone or with allies?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* Singleplayer Option */}
        <div 
          onClick={() => { setLastMode('singleplayer'); navigate('/dashboard/singleplayer'); }}
          className="panel group cursor-pointer relative transition-all duration-300 transform border-2 border-dark-border hover:-translate-y-2 hover:border-gold shadow-[0_0_15px_rgba(255,183,3,0.1)] hover:shadow-[0_0_30px_rgba(255,183,3,0.3)] flex flex-col items-center p-10 text-center"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"></div>
          <div className="text-7xl mb-6 drop-shadow-lg transform transition-transform group-hover:scale-110">🛡️</div>
          <h3 className="font-title text-3xl font-bold text-gray-100 drop-shadow-sm mb-3">Singleplayer</h3>
          <p className="text-gray-400 font-serif italic mb-6">Explore the dungeon, level up your heroes, and uncover secrets on your own.</p>
          <button className="btn btn-gold w-full shadow-glow-gold relative z-10">
            Play Solo
          </button>
        </div>

        {/* Multiplayer Option */}
        <div 
          onClick={() => { setLastMode('multiplayer'); navigate('/dashboard/multiplayer'); }}
          className="panel group cursor-pointer relative transition-all duration-300 transform border-2 border-dark-border hover:-translate-y-2 hover:border-primary shadow-[0_0_15px_rgba(157,78,221,0.1)] hover:shadow-[0_0_30px_rgba(157,78,221,0.3)] flex flex-col items-center p-10 text-center"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"></div>
          <div className="text-7xl mb-6 drop-shadow-lg transform transition-transform group-hover:scale-110">🏰</div>
          <h3 className="font-title text-3xl font-bold text-gray-100 drop-shadow-sm mb-3">Multiplayer</h3>
          <p className="text-gray-400 font-serif italic mb-6">Join forces with other heroes in the Co-Op Lobby to conquer the depths together.</p>
          <button className="btn btn-arcane w-full shadow-glow-primary relative z-10">
            Play Co-Op
          </button>
        </div>
      </div>
    </div>
  );
}
