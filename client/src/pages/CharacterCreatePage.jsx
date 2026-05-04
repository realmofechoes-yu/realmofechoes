import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import api from '../utils/api';
import { CLASS_INFO } from '../data/gameData';

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
    <div className="max-w-6xl mx-auto animate-fade-in pb-12">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-title font-bold text-gold drop-shadow-md mb-2 flex items-center justify-center gap-3">
          <span className="text-4xl">✨</span> Forge a New Hero
        </h2>
        <p className="text-gray-400 font-serif italic">Choose your class and name your champion.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        {Object.entries(CLASS_INFO).map(([key, info]) => {
          const isSelected = selectedClass === key;
          // Map class colors to tailwind border/shadow classes dynamically based on our custom config
          const borderColor = key === 'warrior' ? 'border-red-500' : key === 'mage' ? 'border-purple-500' : 'border-green-500';
          const shadowGlow = key === 'warrior' ? 'shadow-[0_0_30px_rgba(255,77,77,0.3)]' : key === 'mage' ? 'shadow-[0_0_30px_rgba(140,82,255,0.3)]' : 'shadow-[0_0_30px_rgba(46,213,115,0.3)]';
          const bgGradient = key === 'warrior' ? 'from-red-900/20' : key === 'mage' ? 'from-purple-900/20' : 'from-green-900/20';

          return (
            <div 
              key={key}
              className={`panel group cursor-pointer relative transition-all duration-300 transform ${isSelected ? `!border-2 ${borderColor} ${shadowGlow} -translate-y-2` : 'border-2 border-dark-border hover:-translate-y-1 hover:border-gray-500'}`}
              onClick={() => setSelectedClass(key)}
              id={`class-${key}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-b ${bgGradient} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isSelected ? 'opacity-100' : ''}`}></div>
              
              <div className="relative z-10 flex flex-col items-center">
                <div className="text-5xl mb-4 drop-shadow-lg flex items-center justify-center h-16">{info.sprite ? <img src={info.sprite} alt={info.name} className="w-16 h-16 object-contain drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]" /> : info.icon}</div>
                <h3 className="font-title text-2xl font-bold mb-2 tracking-wide" style={{ color: info.colorBright }}>{info.name}</h3>
                <p className="text-sm text-gray-400 text-center mb-6 leading-relaxed font-serif italic min-h-[60px]">{info.description}</p>

                <div className="w-full grid grid-cols-3 gap-2 mb-8 bg-dark-bg/50 p-3 rounded-lg border border-dark-border/50">
                  <div className="flex flex-col items-center"><span className="text-[10px] text-gray-500 font-bold tracking-widest">HP</span><span className="font-title text-gray-200">{info.stats.hp}</span></div>
                  <div className="flex flex-col items-center"><span className="text-[10px] text-gray-500 font-bold tracking-widest">SP</span><span className="font-title text-gray-200">{info.stats.sp}</span></div>
                  <div className="flex flex-col items-center"><span className="text-[10px] text-gray-500 font-bold tracking-widest">STR</span><span className="font-title text-gray-200">{info.stats.str}</span></div>
                  <div className="flex flex-col items-center"><span className="text-[10px] text-gray-500 font-bold tracking-widest">INT</span><span className="font-title text-gray-200">{info.stats.intel}</span></div>
                  <div className="flex flex-col items-center"><span className="text-[10px] text-gray-500 font-bold tracking-widest">DEX</span><span className="font-title text-gray-200">{info.stats.dex}</span></div>
                  <div className="flex flex-col items-center"><span className="text-[10px] text-gray-500 font-bold tracking-widest">VIT</span><span className="font-title text-gray-200">{info.stats.vit}</span></div>
                </div>

                <div className="w-full text-left">
                  <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 border-b border-dark-border pb-1">Skills</h4>
                  <div className="flex flex-col gap-3">
                    {info.skills.map(s => (
                      <div key={s.key} className="flex items-start gap-3">
                        <span className="text-xl pt-1 drop-shadow-sm">{s.icon}</span>
                        <div>
                          <div className="text-sm font-bold text-gray-200">{s.name}</div>
                          <div className="text-xs text-gray-400">{s.description} • <span className="text-blue-300">{s.cost} SP</span></div>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-start gap-3 opacity-90 mt-2 bg-dark-bg/30 p-2 rounded border border-dark-border/30">
                      <span className="text-xl pt-1 drop-shadow-sm">{info.passive.icon}</span>
                      <div>
                        <div className="text-sm font-bold text-gray-200 flex items-center gap-2">
                          {info.passive.name} 
                          <span className="text-[9px] bg-gold/10 text-gold border border-gold/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Passive</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1 font-serif italic">{info.passive.description}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="absolute -top-3 -right-3 w-8 h-8 bg-gold text-dark-bg rounded-full flex items-center justify-center font-bold text-lg shadow-glow-gold animate-fade-in z-20 border-2 border-dark-surface">
                    ✓
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleCreate} className="panel panel-glow max-w-lg mx-auto bg-dark-surface/80 relative z-20">
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm text-center mb-6">
            {error}
          </div>
        )}
        <div className="form-group mb-8">
          <label className="form-label text-center !text-sm !text-gray-300" htmlFor="hero-name">Name Your Legend</label>
          <input 
            className="form-input text-center text-xl font-title tracking-wider !py-4" 
            id="hero-name" 
            type="text" 
            value={name}
            onChange={e => setName(e.target.value)} 
            placeholder="E.g., Aragorn" 
            required 
            maxLength={24} 
          />
        </div>
        <button 
          className="btn btn-gold w-full !py-4 !text-lg" 
          type="submit" 
          disabled={loading || !selectedClass} 
          id="create-hero-btn"
        >
          {loading ? 'Forging...' : '⚔️ Begin Adventure'}
        </button>
      </form>
    </div>
  );
}
