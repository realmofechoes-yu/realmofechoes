import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import { useAudio } from '../../context/AudioContext';
import api from '../../utils/api';
import { STAT_LABELS, STAT_DESCRIPTIONS } from '../../data/gameData';
import '../../pages/LevelUpPage.css';

export default function LevelUpPage() {
  const { charId } = useParams();
  const navigate = useNavigate();
  const { currentCharacter, setCurrentCharacter } = useGame();
  const [char, setChar] = useState(null);
  const [allocation, setAllocation] = useState({ str: 0, intel: 0, dex: 0, vit: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { playTrack } = useAudio();

  useEffect(() => {
    playTrack('minigame.mp3');
    loadCharacter();
  }, [charId, playTrack]);

  const loadCharacter = async () => {
    try {
      const data = await api.getCharacter(parseInt(charId));
      setChar(data.character);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const totalSpent = Object.values(allocation).reduce((s, v) => s + v, 0);
  const remaining = (char?.stat_points || 0) - totalSpent;

  const increment = (stat) => {
    if (remaining <= 0) return;
    setAllocation(prev => ({ ...prev, [stat]: prev[stat] + 1 }));
  };
  const decrement = (stat) => {
    if (allocation[stat] <= 0) return;
    setAllocation(prev => ({ ...prev, [stat]: prev[stat] - 1 }));
  };

  const handleConfirm = async () => {
    if (totalSpent === 0) return;
    setSaving(true);
    try {
      const updated = await api.updateCharacter(parseInt(charId), allocation);
      setCurrentCharacter(updated);
      navigate(`/singleplayer/dungeon/${charId}`);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  if (loading || !char) return <div className="loader-container"><div className="loader"></div></div>;
  if (char.stat_points === 0) {
    return (
      <div className="levelup-page animate-fade-in text-center">
        <h2 className="page-title">📊 Stats</h2>
        <p className="text-dim mt-lg">No stat points available.</p>
        <button className="btn btn-ghost mt-lg" onClick={() => navigate(`/singleplayer/dungeon/${charId}`)}>Back to Dungeon</button>
      </div>
    );
  }

  return (
    <div className="levelup-page animate-fade-in">
      <h2 className="page-title">📊 Allocate Stat Points</h2>
      <p className="page-subtitle">You have <strong className="text-gold">{remaining}</strong> points remaining.</p>

      <div className="stat-grid">
        {['str', 'intel', 'dex', 'vit'].map(stat => (
          <div key={stat} className="stat-alloc-card panel">
            <div className="stat-header">
              <h3 className="stat-name">{STAT_LABELS[stat]}</h3>
              <p className="stat-desc">{STAT_DESCRIPTIONS[stat]}</p>
            </div>
            <div className="stat-values">
              <span className="stat-current">{char[stat]}</span>
              {allocation[stat] > 0 && (
                <span className="stat-bonus">+{allocation[stat]}</span>
              )}
              <span className="stat-arrow">→</span>
              <span className="stat-new">{char[stat] + allocation[stat]}</span>
            </div>
            <div className="stat-controls">
              <button className="btn btn-ghost btn-sm" onClick={() => decrement(stat)} disabled={allocation[stat] === 0}>−</button>
              <span className="stat-alloc-count">{allocation[stat]}</span>
              <button className="btn btn-gold btn-sm" onClick={() => increment(stat)} disabled={remaining === 0}>+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="stat-preview panel mt-lg">
        <h4>Preview</h4>
        <div className="preview-grid">
          <div><span>Max HP:</span> <span>{char.max_hp} → <strong className="text-success">{char.max_hp + allocation.vit * 5}</strong></span></div>
          <div><span>Max SP:</span> <span>{char.max_sp} → <strong className="text-info">{char.max_sp + allocation.intel * 3}</strong></span></div>
        </div>
      </div>

      <div className="levelup-actions mt-lg">
        <button className="btn btn-gold btn-lg" onClick={handleConfirm} disabled={totalSpent === 0 || saving} id="confirm-stats">
          {saving ? 'Saving...' : '✓ Confirm Allocation'}
        </button>
        <button className="btn btn-ghost btn-lg" onClick={() => navigate(`/singleplayer/dungeon/${charId}`)}>Skip</button>
      </div>
    </div>
  );
}
