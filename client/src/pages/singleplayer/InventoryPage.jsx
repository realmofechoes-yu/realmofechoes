import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import { useAudio } from '../../context/AudioContext';
import api from '../../utils/api';
import { RARITY_LABELS } from '../../data/gameData';

export default function InventoryPage() {
  const { charId } = useParams();
  const navigate = useNavigate();
  const { currentCharacter, setCurrentCharacter } = useGame();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const { playTrack } = useAudio();

  useEffect(() => { 
    playTrack('minigame.mp3');
    loadInventory(); 
  }, [charId, filter, sort, playTrack]);

  const loadInventory = async () => {
    try {
      const params = {};
      if (filter) params.type = filter;
      if (sort) params.sort = sort;
      const data = await api.getInventory(parseInt(charId), params);
      setItems(data.items || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleEquip = async (itemId) => {
    try {
      const data = await api.equipItem(parseInt(charId), itemId);
      setItems(data.inventory);
      setSelectedItem(null);
    } catch (err) { console.error(err); }
  };

  const handleUnequip = async (itemId) => {
    try {
      const data = await api.unequipItem(parseInt(charId), itemId);
      setItems(data.inventory);
      setSelectedItem(null);
    } catch (err) { console.error(err); }
  };

  const handleUse = async (itemId) => {
    try {
      const data = await api.useItem(parseInt(charId), itemId);
      if (data.character) setCurrentCharacter(data.character);
      loadInventory();
      setSelectedItem(null);
    } catch (err) { console.error(err); }
  };

  const handleDiscard = async (itemId) => {
    if (!confirm('Discard this item?')) return;
    try {
      await api.discardItem(itemId);
      loadInventory();
      setSelectedItem(null);
    } catch (err) { console.error(err); }
  };

  const equipped = items.filter(i => i.is_equipped);
  const backpack = items.filter(i => !i.is_equipped);

  const parseStats = (statsStr) => {
    try { return JSON.parse(statsStr); } catch { return {}; }
  };

  const getRarityStyles = (rarity) => {
    switch (rarity) {
      case 'uncommon': return { border: 'border-green-500/50 hover:border-green-400', badge: 'bg-green-900/40 text-green-400 border-green-500/50' };
      case 'rare': return { border: 'border-blue-500/50 hover:border-blue-400', badge: 'bg-blue-900/40 text-blue-400 border-blue-500/50' };
      case 'epic': return { border: 'border-purple-500/50 hover:border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.15)]', badge: 'bg-purple-900/40 text-purple-400 border-purple-500/50' };
      case 'legendary': return { border: 'border-gold shadow-glow-gold bg-gold/5 hover:border-yellow-400', badge: 'bg-gold/20 text-gold border-gold/50 shadow-glow-gold' };
      default: return { border: 'border-gray-600 hover:border-gray-500', badge: 'bg-gray-800 text-gray-400 border-gray-600' };
    }
  };

  if (loading) return <div className="max-w-5xl mx-auto p-8 animate-fade-in text-center flex flex-col items-center justify-center min-h-[60vh]"><div className="w-12 h-12 border-4 border-dark-border border-t-gold rounded-full animate-spin mb-4"></div><p className="text-gray-400 font-serif italic">Rummaging through your bags...</p></div>;

  const { combatState } = useGame();
  const isInCombat = !!combatState;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <h2 className="text-3xl font-title font-bold text-gold drop-shadow-md flex items-center gap-3">
          <span className="text-4xl">🎒</span> Inventory
        </h2>
        <button 
          className="btn btn-ghost border border-dark-border/50 px-6 py-2" 
          onClick={() => navigate(isInCombat ? `/singleplayer/combat/${charId}` : `/singleplayer/dungeon/${charId}`)}
        >
          {isInCombat ? '⚔️ Return to Fight' : '⬅️ Return to Dungeon'}
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8 bg-dark-surface/60 p-4 rounded-xl border border-dark-border/50">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 uppercase tracking-widest font-bold mb-2">Filter</label>
          <select className="w-full bg-dark-bg border border-dark-border rounded px-4 py-2 text-gray-200 outline-none focus:border-gold/50 transition-colors" value={filter} onChange={e => setFilter(e.target.value)} id="inv-filter">
            <option value="">All Types</option>
            <option value="weapon">Weapons</option>
            <option value="armor">Armor</option>
            <option value="accessory">Accessories</option>
            <option value="consumable">Consumables</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 uppercase tracking-widest font-bold mb-2">Sort</label>
          <select className="w-full bg-dark-bg border border-dark-border rounded px-4 py-2 text-gray-200 outline-none focus:border-gold/50 transition-colors" value={sort} onChange={e => setSort(e.target.value)} id="inv-sort">
            <option value="">Default</option>
            <option value="rarity">By Rarity</option>
            <option value="name">By Name</option>
            <option value="type">By Type</option>
          </select>
        </div>
      </div>

      {equipped.length > 0 && (
        <div className="mb-10">
          <h3 className="font-title text-xl font-bold text-gray-200 mb-4 flex items-center gap-2 border-b border-dark-border pb-2">
            <span>⚔️</span> Equipped
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {equipped.map(item => {
              const stats = parseStats(item.stats);
              const styles = getRarityStyles(item.rarity);
              return (
                <div key={item.id} className={`panel flex flex-col relative cursor-pointer overflow-hidden group transition-all duration-300 hover:-translate-y-1 bg-dark-surface/80 border-2 ${styles.border}`}
                  onClick={() => setSelectedItem(item)} id={`item-${item.id}`}>
                  
                  <div className="absolute top-0 right-0 bg-gold/90 text-dark-bg text-[9px] font-bold uppercase px-3 py-1 rounded-bl-lg shadow-sm z-10">
                    Equipped
                  </div>

                  <div className="flex justify-between items-start mb-1 pr-16">
                    <span className="font-bold text-gray-100 truncate">{item.name}</span>
                  </div>
                  
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-gray-400 uppercase tracking-widest">{item.type}</span>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${styles.badge}`}>{RARITY_LABELS[item.rarity]}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-auto pt-3 border-t border-dark-border/50">
                    {Object.entries(stats).filter(([k]) => ['str','intel','dex','vit'].includes(k)).map(([k, v]) => (
                      <span key={k} className="text-[10px] font-bold text-green-400 bg-green-900/20 border border-green-500/20 px-1.5 py-0.5 rounded">+{v} {k.toUpperCase()}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="font-title text-xl font-bold text-gray-200 mb-4 flex items-center gap-2 border-b border-dark-border pb-2">
          <span>🎒</span> Backpack ({backpack.length})
        </h3>
        {backpack.length === 0 ? (
          <div className="panel bg-dark-surface/40 border-dashed border-dark-border border-2 flex flex-col items-center justify-center p-12 opacity-70">
            <span className="text-5xl mb-4 grayscale opacity-50">🎒</span>
            <p className="text-gray-400 font-serif italic">Your backpack is empty.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {backpack.map(item => {
              const stats = parseStats(item.stats);
              const styles = getRarityStyles(item.rarity);
              return (
                <div key={item.id} className={`panel flex flex-col cursor-pointer transition-all duration-300 hover:-translate-y-1 bg-dark-surface/60 border ${styles.border}`}
                  onClick={() => setSelectedItem(item)} id={`item-${item.id}`}>
                  
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-gray-100 line-clamp-1 flex-1 pr-2">{item.name}</span>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border flex-shrink-0 ${styles.badge}`}>{RARITY_LABELS[item.rarity]}</span>
                  </div>
                  
                  <div className="text-xs text-gray-400 uppercase tracking-widest mb-2 font-medium">
                    {item.type} {item.quantity > 1 ? <span className="text-gold ml-1">×{item.quantity}</span> : ''}
                  </div>
                  
                  <div className="text-xs text-gray-500 italic mb-4 line-clamp-2 flex-1 min-h-[2rem]">
                    {item.description}
                  </div>

                  {Object.keys(stats).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-3 border-t border-dark-border/50">
                      {Object.entries(stats).filter(([k]) => ['str','intel','dex','vit'].includes(k)).map(([k, v]) => (
                        <span key={k} className="text-[10px] font-bold text-green-400 bg-green-900/20 border border-green-500/20 px-1.5 py-0.5 rounded">+{v} {k.toUpperCase()}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setSelectedItem(null)}>
          <div className={`panel w-full max-w-sm flex flex-col shadow-2xl relative border-2 bg-dark-surface animate-slide-up ${getRarityStyles(selectedItem.rarity).border}`} onClick={e => e.stopPropagation()}>
            
            <button className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 w-8 h-8 flex items-center justify-center rounded-full bg-dark-bg/50" onClick={() => setSelectedItem(null)}>✕</button>

            <div className="text-center mb-6 pt-4">
              <span className={`inline-block text-[10px] font-bold uppercase px-3 py-1 rounded-full border mb-3 ${getRarityStyles(selectedItem.rarity).badge}`}>
                {RARITY_LABELS[selectedItem.rarity]}
              </span>
              <h3 className="font-title text-2xl font-bold text-gray-100">{selectedItem.name}</h3>
              <p className="text-sm text-gray-400 uppercase tracking-widest mt-1">{selectedItem.type}</p>
            </div>
            
            <div className="bg-dark-bg/60 rounded-lg p-4 border border-dark-border mb-6">
              <p className="text-sm text-gray-300 italic mb-4 text-center">"{selectedItem.description}"</p>
              
              {Object.keys(parseStats(selectedItem.stats)).length > 0 && (
                <div className="space-y-2 pt-4 border-t border-dark-border/50">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center mb-2">Item Bonuses</h4>
                  {Object.entries(parseStats(selectedItem.stats)).filter(([k]) => ['str','intel','dex','vit'].includes(k)).map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center bg-dark-surface p-2 rounded border border-dark-border/50">
                      <span className="text-xs font-bold text-gray-300">{k.toUpperCase()}</span>
                      <span className="text-sm font-bold text-green-400">+{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 mt-auto">
              {selectedItem.is_equipped ? (
                <button className="btn btn-ghost w-full py-3" onClick={() => handleUnequip(selectedItem.id)}>↓ Unequip Item</button>
              ) : selectedItem.type === 'consumable' ? (
                <button className="btn btn-ember shadow-glow-health w-full py-3" onClick={() => handleUse(selectedItem.id)}>🧪 Use Item</button>
              ) : (
                <button className="btn btn-gold shadow-glow-gold w-full py-3" onClick={() => handleEquip(selectedItem.id)}>⚔️ Equip Item</button>
              )}
              
              <button className="text-xs text-red-500/70 hover:text-red-400 font-bold py-2 mt-2 transition-colors uppercase tracking-widest" onClick={() => handleDiscard(selectedItem.id)}>
                🗑️ Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
