import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { useAudio } from '../../context/AudioContext';
import { useState, useEffect } from 'react';
import { useSocketContext } from '../../context/SocketContext';
import { useSocketEmit } from '../../hooks/useSocket';
import ActiveSessionBanner from './ActiveSessionBanner';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { 
    currentCharacter, clearGameState, 
    coopSessionId, coopCharacterId, 
    lastSingleplayerCharId, lastMode,
    abandonSession
  } = useGame();
  const { connected } = useSocketContext();
  const { emit } = useSocketEmit();
  const { isMuted, toggleMute } = useAudio();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Validate co-op session on mount/connect
  useEffect(() => {
    if (connected && coopSessionId) {
      console.log('Validating session:', coopSessionId);
      emit('session:sync', { sessionId: coopSessionId })
        .then(() => {
          console.log('Session is valid.');
        })
        .catch((err) => {
          // If the server explicitly says it's not found, we clear it
          if (err.message.includes('not found') || err.message.includes('No session')) {
            console.log('Stale session detected, clearing:', err.message);
            abandonSession();
          }
        });
    }
  }, [connected, coopSessionId, abandonSession, emit]);

  const handleLogout = () => {
    clearGameState();
    logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col min-h-screen bg-dark-bg text-gray-100 font-sans">
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 h-16 bg-dark-surface/60 backdrop-blur-lg border-b border-dark-border shadow-md">
        <div className="flex items-center gap-4">
          <button 
            className="md:hidden text-2xl text-gray-300 hover:text-white transition-colors" 
            onClick={() => setSidebarOpen(!sidebarOpen)} 
            id="menu-toggle"
          >
            ☰
          </button>
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/dashboard')}>
            <span className="text-2xl group-hover:scale-110 transition-transform">🗡️</span>
            <h1 className="text-xl font-title font-bold tracking-wider bg-gradient-to-r from-gold to-gold-bright bg-clip-text text-transparent drop-shadow-sm">
              Realm of Echoes
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {currentCharacter && (
            <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-dark-hover/50 rounded-full border border-dark-border/50 shadow-inner">
              <span className="font-semibold text-sm text-gray-200">{currentCharacter.name}</span>
              <span className="text-gold font-bold text-sm">Lv.{currentCharacter.level}</span>
            </div>
          )}
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleMute} 
              className="text-xl opacity-70 hover:opacity-100 transition-opacity"
              title={isMuted ? "Unmute Sound" : "Mute Sound"}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
            <span className="text-sm text-gray-400 hidden sm:inline-block">⚜️ {user?.username}</span>
            <button className="btn btn-ghost !py-1.5 !px-4 !text-xs" onClick={handleLogout} id="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Sidebar */}
        <nav className={`
          fixed md:sticky top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-dark-surface/80 backdrop-blur-xl border-r border-dark-border
          flex flex-col justify-between py-6 z-40 transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="flex flex-col gap-1 px-3">
            <NavLink to={coopSessionId ? `/dashboard/multiplayer` : `/dashboard/${lastMode}`} className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${isActive ? 'bg-gold/10 text-gold border-l-4 border-gold shadow-[inset_4px_0_0_0_rgba(255,183,3,1)]' : 'text-gray-400 hover:text-white hover:bg-dark-hover border-l-4 border-transparent'}`} onClick={() => setSidebarOpen(false)} id="nav-dashboard">
              <span className="text-xl w-6 text-center">🏰</span><span>Dashboard</span>
            </NavLink>
            <NavLink to={coopSessionId ? `/create/multiplayer` : `/create/${lastMode}`} className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${isActive ? 'bg-gold/10 text-gold border-l-4 border-gold shadow-[inset_4px_0_0_0_rgba(255,183,3,1)]' : 'text-gray-400 hover:text-white hover:bg-dark-hover border-l-4 border-transparent'}`} onClick={() => setSidebarOpen(false)} id="nav-create">
              <span className="text-xl w-6 text-center">✨</span><span>New Hero</span>
            </NavLink>
            {(currentCharacter || coopCharacterId || lastSingleplayerCharId) && (
              <>
                <NavLink 
                  to={coopSessionId ? `/multiplayer/dungeon/${coopCharacterId}/${coopSessionId}` : `/singleplayer/dungeon/${currentCharacter?.id || lastSingleplayerCharId}`} 
                  className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${isActive ? 'bg-gold/10 text-gold border-l-4 border-gold shadow-[inset_4px_0_0_0_rgba(255,183,3,1)]' : 'text-gray-400 hover:text-white hover:bg-dark-hover border-l-4 border-transparent'}`} 
                  onClick={() => setSidebarOpen(false)} 
                  id="nav-dungeon"
                >
                  <span className="text-xl w-6 text-center">🗺️</span><span>Dungeon</span>
                </NavLink>
                <NavLink 
                  to={coopSessionId ? `/multiplayer/inventory/${coopCharacterId}/${coopSessionId}` : `/singleplayer/inventory/${currentCharacter?.id || lastSingleplayerCharId}`} 
                  className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${isActive ? 'bg-gold/10 text-gold border-l-4 border-gold shadow-[inset_4px_0_0_0_rgba(255,183,3,1)]' : 'text-gray-400 hover:text-white hover:bg-dark-hover border-l-4 border-transparent'}`} 
                  onClick={() => setSidebarOpen(false)} 
                  id="nav-inventory"
                >
                  <span className="text-xl w-6 text-center">🎒</span><span>Inventory</span>
                </NavLink>
              </>
            )}
            <NavLink to="/leaderboard" className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${isActive ? 'bg-gold/10 text-gold border-l-4 border-gold shadow-[inset_4px_0_0_0_rgba(255,183,3,1)]' : 'text-gray-400 hover:text-white hover:bg-dark-hover border-l-4 border-transparent'}`} onClick={() => setSidebarOpen(false)} id="nav-leaderboard">
              <span className="text-xl w-6 text-center">🏆</span><span>Leaderboard</span>
            </NavLink>
          </div>
          
          <div className="px-6 py-4 border-t border-dark-border/50">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                <span>Total Runs</span><span className="text-gold font-bold">{user?.total_runs || 0}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                <span>Deepest</span><span className="text-gold font-bold">Floor {user?.deepest_floor || 0}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                <span>Gold</span><span className="text-gold font-bold">{user?.total_gold || 0}</span>
              </div>
            </div>
          </div>
        </nav>

        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden" 
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 overflow-x-hidden">
          <ActiveSessionBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
