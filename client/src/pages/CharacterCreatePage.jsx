import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import api from '../utils/api';
import { CLASS_INFO } from '../data/gameData';
import './CharacterCreatePage.css';

export default function CharacterCreatePage() {
  const [selectedClass, setSelectedClass] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setCurrentCharacter, setSkills } = useGame();
  const navigate = useNavigate();

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!selectedClass) return setError('Select a class.');
    if (!name.trim()) return setError('Enter a name.');
    setError('');
    setLoading(true);
    try {
      const data = await api.createCharacter(name.trim(), selectedClass);
      setCurrentCharacter(data.character);
      setSkills(data.skills);
      navigate(`/dungeon/${data.character.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-page animate-fade-in">
      <h2 className="page-title">✨ Forge a New Hero</h2>
      <p className="page-subtitle">Choose your class and name your champion.</p>

      <div className="class-grid">
        {Object.entries(CLASS_INFO).map(([key, info]) => (
          <div key={key}
            className={`class-card panel ${selectedClass === key ? 'class-selected' : ''}`}
            onClick={() => setSelectedClass(key)}
            style={{ '--class-color': info.color, '--class-bright': info.colorBright }}
            id={`class-${key}`}
          >
            <div className="class-icon">{info.icon}</div>
            <h3 className="class-name">{info.name}</h3>
            <p className="class-desc">{info.description}</p>

            <div className="class-stats">
              <div className="class-stat"><span>HP</span><span>{info.stats.hp}</span></div>
              <div className="class-stat"><span>SP</span><span>{info.stats.sp}</span></div>
              <div className="class-stat"><span>STR</span><span>{info.stats.str}</span></div>
              <div className="class-stat"><span>INT</span><span>{info.stats.intel}</span></div>
              <div className="class-stat"><span>DEX</span><span>{info.stats.dex}</span></div>
              <div className="class-stat"><span>VIT</span><span>{info.stats.vit}</span></div>
            </div>

            <div className="class-abilities">
              <h4>Skills</h4>
              {info.skills.map(s => (
                <div key={s.key} className="ability-row">
                  <span className="ability-icon">{s.icon}</span>
                  <div>
                    <div className="ability-name">{s.name}</div>
                    <div className="ability-desc">{s.description} • {s.cost}</div>
                  </div>
                </div>
              ))}
              <div className="ability-row passive">
                <span className="ability-icon">{info.passive.icon}</span>
                <div>
                  <div className="ability-name">{info.passive.name} <span className="passive-tag">Passive</span></div>
                  <div className="ability-desc">{info.passive.description}</div>
                </div>
              </div>
            </div>

            {selectedClass === key && <div className="class-check">✓</div>}
          </div>
        ))}
      </div>

      <form onSubmit={handleCreate} className="create-form panel">
        {error && <div className="auth-error">{error}</div>}
        <div className="form-group">
          <label className="form-label" htmlFor="hero-name">Hero Name</label>
          <input className="form-input" id="hero-name" type="text" value={name}
            onChange={e => setName(e.target.value)} placeholder="Enter your hero's name" required maxLength={24} />
        </div>
        <button className="btn btn-gold btn-lg btn-full" type="submit" disabled={loading || !selectedClass} id="create-hero-btn">
          {loading ? 'Forging...' : '⚔️ Begin Adventure'}
        </button>
      </form>
    </div>
  );
}
