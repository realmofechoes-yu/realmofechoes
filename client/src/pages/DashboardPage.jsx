import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';
import api from '../utils/api';
import { CLASS_INFO } from '../data/gameData';

export default function DashboardPage() {
  const { user, refreshProfile } = useAuth();
  const { setCurrentCharacter, clearGameState } = useGame();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    clearGameState();
    loadCharacters();
    refreshProfile();
  }, []);

  const loadCharacters = async () => {
    try {
      const data = await api.getCharacters();
      setCharacters(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleContinue = (char) => {
    setCurrentCharacter(char);
    if (!char.is_alive || char.run_status === 'dead') {
      navigate(`/summary/${char.id}`);
    } else {
      navigate(`/dungeon/${char.id}`);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this character? This cannot be undone.')) return;
    try {
      await api.deleteCharacter(id);
      setCharacters(characters.filter(c => c.id !== id));
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4"><div className="w-12 h-12 border-4 border-dark-border border-t-gold rounded-full animate-spin"></div><p className="text-gray-400 font-serif italic">Summoning heroes...</p></div>;

  return (
    <div className="w-full max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h2 className="text-3xl font-title font-bold text-gold drop-shadow-md flex items-center gap-3">
            <span className="text-4xl">⚜️</span> Hall of Heroes
          </h2>
          <p className="text-gray-400 mt-2 font-serif italic">Select a champion or forge a new legend.</p>
        </div>
        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          <button className="btn btn-danger flex-1 md:flex-none shadow-glow-health" onClick={() => navigate('/lobby')} id="coop-btn">
            <span className="text-lg">🏰</span> Co-Op Lobby
          </button>
          <button className="btn btn-gold flex-1 md:flex-none shadow-glow-gold" onClick={() => navigate('/create')} id="new-hero-btn">
            <span className="text-lg">✨</span> New Hero
          </button>
        </div>
      </div>

      {user?.achievements && user.achievements.length > 0 && (
        <div className="mb-10 panel bg-dark-surface/40 border-gold/20">
          <h4 className="font-title text-gold mb-4 text-lg flex items-center gap-2">🏆 Achievements</h4>
          <div className="flex flex-wrap gap-3">
            {user.achievements.map(a => (
              <div key={a.achievement_key} className="flex items-center gap-2 px-4 py-2 bg-dark-bg/60 border border-dark-border hover:border-gold hover:bg-gold/5 rounded-full text-sm text-gray-300 hover:text-gold transition-all duration-300 cursor-default shadow-sm" title={a.description}>
                <span className="text-lg">{a.icon}</span>
                <span className="font-medium">{a.achievement_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {characters.length === 0 ? (
        <div className="text-center py-20 panel panel-glow bg-dark-surface/40 border-gold/30">
          <div className="text-6xl mb-6 opacity-80 animate-float">🗡️</div>
          <h3 className="font-title text-2xl text-gold mb-3 drop-shadow-sm">No Heroes Yet</h3>
          <p className="text-gray-400 mb-8 font-serif italic">Create your first champion to begin your journey into the dungeon.</p>
          <button className="btn btn-gold !py-3 !px-8 text-base shadow-glow-gold" onClick={() => navigate('/create')}>
            ✨ Forge Your First Hero
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map((char, i) => {
            const info = CLASS_INFO[char.class];
            const hpPercent = (char.hp / char.max_hp) * 100;
            const spPercent = (char.sp / char.max_sp) * 100;
            const isDead = !char.is_alive || char.run_status === 'dead';
            
            // Generate a subtle gradient overlay based on class
            const classGradient = char.class === 'warrior' ? 'from-red-900/20' 
                               : char.class === 'mage' ? 'from-purple-900/20' 
                               : 'from-green-900/20';

            return (
              <div 
                key={char.id} 
                className={`panel group overflow-hidden relative ${isDead ? 'opacity-75 grayscale-[30%]' : ''}`} 
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                {/* Class-based subtle background gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${classGradient} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>

                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="flex gap-4">
                    <div className="text-4xl drop-shadow-lg flex items-center justify-center w-12 h-12">{(info?.sprites?.idle || info?.sprite) ? <img src={isDead ? (info?.sprites?.dead || info?.sprites?.idle || info?.sprite) : (info?.sprites?.idle || info?.sprite)} alt={info?.name} className="w-12 h-12 object-contain drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]" /> : <span style={{ color: info?.colorBright }}>{info?.icon}</span>}</div>
                    <div>
                      <h3 className="font-title text-xl font-bold text-gray-100 drop-shadow-sm">{char.name}</h3>
                      <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: info?.colorBright }}>{info?.name}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="font-title text-lg font-bold text-gold bg-gold/10 px-3 py-1 rounded-full border border-gold/30 shadow-inner">
                      Lv.{char.level}
                    </div>
                    {isDead && (
                      <div className="bg-red-900/80 backdrop-blur text-red-200 text-xs font-bold px-3 py-1 rounded-full border border-red-500/50 shadow-glow-health animate-pulse-slow">
                        💀 Fallen
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 mb-6 relative z-10">
                  <div className="w-full bg-dark-bg h-4 rounded-full border border-dark-border overflow-hidden relative shadow-inner">
                    <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-health to-red-400 transition-all duration-500 ease-out" style={{ width: `${hpPercent}%` }}></div>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white tracking-widest drop-shadow-md">
                      HP {char.hp}/{char.max_hp}
                    </span>
                  </div>
                  <div className="w-full bg-dark-bg h-4 rounded-full border border-dark-border overflow-hidden relative shadow-inner">
                    <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-mana to-blue-300 transition-all duration-500 ease-out" style={{ width: `${spPercent}%` }}></div>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white tracking-widest drop-shadow-md">
                      SP {char.sp}/{char.max_sp}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-6 relative z-10">
                  <div className="flex flex-col items-center p-2 bg-dark-bg/80 rounded border border-dark-border group-hover:border-gold/30 transition-colors">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">STR</span>
                    <span className="font-title font-bold text-gray-200">{char.str}</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-dark-bg/80 rounded border border-dark-border group-hover:border-gold/30 transition-colors">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">INT</span>
                    <span className="font-title font-bold text-gray-200">{char.intel}</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-dark-bg/80 rounded border border-dark-border group-hover:border-gold/30 transition-colors">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">DEX</span>
                    <span className="font-title font-bold text-gray-200">{char.dex}</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-dark-bg/80 rounded border border-dark-border group-hover:border-gold/30 transition-colors">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">VIT</span>
                    <span className="font-title font-bold text-gray-200">{char.vit}</span>
                  </div>
                </div>

                <div className="flex justify-between text-xs text-gray-400 font-medium mb-6 px-1 relative z-10">
                  <span className="flex items-center gap-1">🗺️ Floor {char.current_floor}</span>
                  <span className="flex items-center gap-1">💀 {char.enemies_defeated || 0} kills</span>
                  <span className="flex items-center gap-1 text-gold/80">💰 {char.gold} gold</span>
                </div>

                <div className="flex gap-3 relative z-10">
                  <button className="btn btn-gold flex-1 !text-xs !py-2" onClick={() => handleContinue(char)} id={`continue-${char.id}`}>
                    {isDead ? '📜 View Summary' : '⚔️ Continue'}
                  </button>
                  <button className="btn btn-danger !px-4 !py-2" onClick={() => handleDelete(char.id)} id={`delete-${char.id}`} title="Delete Hero">
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
