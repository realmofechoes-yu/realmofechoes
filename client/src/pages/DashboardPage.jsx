import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';
import api from '../utils/api';
import { CLASS_INFO } from '../data/gameData';
import './DashboardPage.css';

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

  if (loading) return <div className="loader-container"><div className="loader"></div><p>Loading heroes...</p></div>;

  return (
    <div className="dashboard animate-fade-in">
      <div className="dashboard-header">
        <div>
          <h2 className="page-title">⚜️ Hall of Heroes</h2>
          <p className="page-subtitle">Select a champion or forge a new legend.</p>
        </div>
        <div className="dashboard-actions">
          <button className="btn btn-ember" onClick={() => navigate('/lobby')} id="coop-btn">🏰 Co-Op Lobby</button>
          <button className="btn btn-gold" onClick={() => navigate('/create')} id="new-hero-btn">✨ New Hero</button>
        </div>
      </div>

      {user?.achievements && user.achievements.length > 0 && (
        <div className="achievements-bar panel">
          <h4>🏆 Achievements</h4>
          <div className="achievement-list">
            {user.achievements.map(a => (
              <div key={a.achievement_key} className="achievement-badge" title={a.description}>
                <span>{a.icon}</span>
                <span>{a.achievement_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {characters.length === 0 ? (
        <div className="empty-state panel">
          <div className="empty-icon">🗡️</div>
          <h3>No Heroes Yet</h3>
          <p>Create your first champion to begin your journey into the dungeon.</p>
          <button className="btn btn-gold btn-lg" onClick={() => navigate('/create')}>✨ Create Your First Hero</button>
        </div>
      ) : (
        <div className="character-grid">
          {characters.map((char, i) => {
            const info = CLASS_INFO[char.class];
            const hpPercent = (char.hp / char.max_hp) * 100;
            const spPercent = (char.sp / char.max_sp) * 100;
            const isDead = !char.is_alive || char.run_status === 'dead';
            return (
              <div key={char.id} className={`char-card panel ${isDead ? 'char-dead' : ''}`} style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="char-card-header">
                  <div className="char-class-icon" style={{ color: info?.colorBright }}>{info?.icon}</div>
                  <div>
                    <h3 className="char-card-name">{char.name}</h3>
                    <span className="char-card-class" style={{ color: info?.colorBright }}>{info?.name}</span>
                  </div>
                  <div className="char-card-level">Lv.{char.level}</div>
                </div>

                <div className="char-card-bars">
                  <div className="stat-bar stat-bar-hp">
                    <div className="stat-bar-fill" style={{ width: `${hpPercent}%` }}></div>
                    <span className="stat-bar-label">HP {char.hp}/{char.max_hp}</span>
                  </div>
                  <div className="stat-bar stat-bar-sp">
                    <div className="stat-bar-fill" style={{ width: `${spPercent}%` }}></div>
                    <span className="stat-bar-label">SP {char.sp}/{char.max_sp}</span>
                  </div>
                </div>

                <div className="char-card-stats">
                  <div className="mini-stat"><span className="mini-stat-label">STR</span><span className="mini-stat-val">{char.str}</span></div>
                  <div className="mini-stat"><span className="mini-stat-label">INT</span><span className="mini-stat-val">{char.intel}</span></div>
                  <div className="mini-stat"><span className="mini-stat-label">DEX</span><span className="mini-stat-val">{char.dex}</span></div>
                  <div className="mini-stat"><span className="mini-stat-label">VIT</span><span className="mini-stat-val">{char.vit}</span></div>
                </div>

                <div className="char-card-info">
                  <span>🗺️ Floor {char.current_floor}</span>
                  <span>💀 {char.enemies_defeated || 0} kills</span>
                  <span>💰 {char.gold} gold</span>
                </div>

                {isDead && <div className="char-dead-overlay"><span>💀 Fallen</span></div>}

                <div className="char-card-actions">
                  <button className="btn btn-gold btn-sm" onClick={() => handleContinue(char)} id={`continue-${char.id}`}>
                    {isDead ? '📜 View Summary' : '⚔️ Continue'}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(char.id)} id={`delete-${char.id}`}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
