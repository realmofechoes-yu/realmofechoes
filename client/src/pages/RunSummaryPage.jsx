import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useAudio } from '../context/AudioContext';
import api from '../utils/api';
import { CLASS_INFO } from '../data/gameData';
import './RunSummaryPage.css';

export default function RunSummaryPage() {
  const { charId } = useParams();
  const navigate = useNavigate();
  const { currentCharacter, clearGameState } = useGame();
  const [char, setChar] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { playTrack } = useAudio();

  useEffect(() => {
    playTrack('rest.mp3');
    loadData();
  }, [charId, playTrack]);

  const loadData = async () => {
    try {
      const data = await api.getCharacter(parseInt(charId));
      setChar(data.character);
      setLogs(data.combatLogs || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleNewRun = () => {
    clearGameState();
    navigate('/create');
  };

  if (loading) return <div className="loader-container"><div className="loader"></div></div>;
  if (!char) return <div className="loader-container"><p>Character not found.</p></div>;

  const info = CLASS_INFO[char.class];
  const isDead = char.run_status === 'dead';
  const isCompleted = char.run_status === 'completed';

  return (
    <div className="summary-page animate-fade-in">
      <div className="summary-banner">
        <div className="summary-icon">{isDead ? '💀' : '🏆'}</div>
        <h2 className="summary-title">{isDead ? 'Fallen in Battle' : 'Dungeon Conquered!'}</h2>
        <p className="summary-subtitle">
          {isDead ? `${char.name} met their end on Floor ${char.current_floor}.` : `${char.name} has triumphed over all challenges!`}
        </p>
      </div>

      <div className="summary-stats-grid">
        <div className="summary-stat panel">
          <span className="summary-stat-icon">🗺️</span>
          <span className="summary-stat-value">{char.current_floor}</span>
          <span className="summary-stat-label">Deepest Floor</span>
        </div>
        <div className="summary-stat panel">
          <span className="summary-stat-icon">💀</span>
          <span className="summary-stat-value">{char.enemies_defeated || 0}</span>
          <span className="summary-stat-label">Enemies Slain</span>
        </div>
        <div className="summary-stat panel">
          <span className="summary-stat-icon">💰</span>
          <span className="summary-stat-value">{char.gold}</span>
          <span className="summary-stat-label">Gold Earned</span>
        </div>
        <div className="summary-stat panel">
          <span className="summary-stat-icon">⭐</span>
          <span className="summary-stat-value">{char.level}</span>
          <span className="summary-stat-label">Final Level</span>
        </div>
        <div className="summary-stat panel">
          <span className="summary-stat-icon">⚔️</span>
          <span className="summary-stat-value">{char.damage_dealt_total || 0}</span>
          <span className="summary-stat-label">Damage Dealt</span>
        </div>
        <div className="summary-stat panel">
          <span className="summary-stat-icon">🛡️</span>
          <span className="summary-stat-value">{char.damage_received_total || 0}</span>
          <span className="summary-stat-label">Damage Taken</span>
        </div>
      </div>

      <div className="summary-character panel">
        <div className="summary-char-info">
          <span className="summary-char-icon">{info?.icon}</span>
          <div>
            <h3>{char.name}</h3>
            <span style={{ color: info?.colorBright }}>{info?.name} • Level {char.level}</span>
          </div>
        </div>
        <div className="summary-final-stats">
          <div><span>STR</span><span>{char.str}</span></div>
          <div><span>INT</span><span>{char.intel}</span></div>
          <div><span>DEX</span><span>{char.dex}</span></div>
          <div><span>VIT</span><span>{char.vit}</span></div>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="summary-logs panel">
          <h3>📜 Combat History</h3>
          <div className="logs-list">
            {logs.map((log, i) => (
              <div key={i} className={`log-row log-${log.outcome}`}>
                <span className="log-enemy">{log.enemy_name}</span>
                <span className="log-floor">Floor {log.floor}</span>
                <span className={`log-outcome ${log.outcome}`}>
                  {log.outcome === 'victory' ? '✓ Victory' : log.outcome === 'defeat' ? '✗ Defeat' : '🏃 Fled'}
                </span>
                <span className="log-detail">{log.turns_taken}t • {log.damage_dealt}dmg • +{log.xp_gained}xp</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="summary-actions">
        <button className="btn btn-gold btn-lg" onClick={handleNewRun} id="new-run-btn">✨ Start New Run</button>
        <button className="btn btn-ghost btn-lg" onClick={() => navigate('/dashboard')} id="back-dashboard-btn">🏰 Dashboard</button>
        <button className="btn btn-ghost btn-lg" onClick={() => navigate('/leaderboard')}>🏆 Leaderboard</button>
      </div>
    </div>
  );
}
