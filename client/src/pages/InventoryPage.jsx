import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import api from '../utils/api';
import { RARITY_LABELS } from '../data/gameData';
import './InventoryPage.css';

export default function InventoryPage() {
  const { charId } = useParams();
  const navigate = useNavigate();
  const { currentCharacter, setCurrentCharacter } = useGame();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => { loadInventory(); }, [charId, filter, sort]);

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

  if (loading) return <div className="loader-container"><div className="loader"></div></div>;

  const { combatState, coopCombatState, coopSessionId } = useGame();
  const isInCombat = !!combatState || !!coopCombatState;

  return (
    <div className="inventory-page animate-fade-in">
      <div className="inv-header-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 className="page-title" style={{ margin: 0 }}>🎒 Inventory</h2>
        <button 
          className="btn btn-ghost" 
          onClick={() => navigate(isInCombat ? `/combat/${charId}${coopSessionId ? `?coop=${coopSessionId}` : ''}` : `/dungeon/${charId}${coopSessionId ? `?coop=${coopSessionId}` : ''}`)}
        >
          {isInCombat ? '⚔️ Return to Fight' : '⬅️ Return to Dungeon'}
        </button>
      </div>

      <div className="inv-controls">
        <div className="filter-group">
          <label className="form-label">Filter</label>
          <select className="form-input inv-select" value={filter} onChange={e => setFilter(e.target.value)} id="inv-filter">
            <option value="">All Types</option>
            <option value="weapon">Weapons</option>
            <option value="armor">Armor</option>
            <option value="accessory">Accessories</option>
            <option value="consumable">Consumables</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="form-label">Sort</label>
          <select className="form-input inv-select" value={sort} onChange={e => setSort(e.target.value)} id="inv-sort">
            <option value="">Default</option>
            <option value="rarity">By Rarity</option>
            <option value="name">By Name</option>
            <option value="type">By Type</option>
          </select>
        </div>
      </div>

      {equipped.length > 0 && (
        <div className="inv-section">
          <h3 className="inv-section-title">⚔️ Equipped</h3>
          <div className="inv-grid">
            {equipped.map(item => {
              const stats = parseStats(item.stats);
              return (
                <div key={item.id} className={`inv-card equipped rarity-${item.rarity}`}
                  onClick={() => setSelectedItem(item)} id={`item-${item.id}`}>
                  <div className="inv-card-header">
                    <span className="inv-item-name">{item.name}</span>
                    <span className={`badge badge-${item.rarity}`}>{RARITY_LABELS[item.rarity]}</span>
                  </div>
                  <div className="inv-item-type">{item.type}</div>
                  <div className="inv-item-stats">
                    {Object.entries(stats).filter(([k]) => ['str','intel','dex','vit'].includes(k)).map(([k, v]) => (
                      <span key={k} className="inv-stat">+{v} {k.toUpperCase()}</span>
                    ))}
                  </div>
                  <div className="equipped-badge">Equipped</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="inv-section">
        <h3 className="inv-section-title">🎒 Backpack ({backpack.length})</h3>
        {backpack.length === 0 ? (
          <p className="text-dim text-center p-lg">Your backpack is empty.</p>
        ) : (
          <div className="inv-grid">
            {backpack.map(item => {
              const stats = parseStats(item.stats);
              return (
                <div key={item.id} className={`inv-card rarity-${item.rarity}`}
                  onClick={() => setSelectedItem(item)} id={`item-${item.id}`}>
                  <div className="inv-card-header">
                    <span className="inv-item-name">{item.name}</span>
                    <span className={`badge badge-${item.rarity}`}>{RARITY_LABELS[item.rarity]}</span>
                  </div>
                  <div className="inv-item-type">{item.type} {item.quantity > 1 ? `×${item.quantity}` : ''}</div>
                  <div className="inv-item-desc">{item.description}</div>
                  <div className="inv-item-stats">
                    {Object.entries(stats).filter(([k]) => ['str','intel','dex','vit'].includes(k)).map(([k, v]) => (
                      <span key={k} className="inv-stat">+{v} {k.toUpperCase()}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">{selectedItem.name}</h3>
            <span className={`badge badge-${selectedItem.rarity}`}>{RARITY_LABELS[selectedItem.rarity]}</span>
            <p className="mt-md text-dim">{selectedItem.description}</p>
            <div className="item-detail-stats mt-md">
              {Object.entries(parseStats(selectedItem.stats)).filter(([k]) => ['str','intel','dex','vit'].includes(k)).map(([k, v]) => (
                <div key={k} className="detail-stat"><span>{k.toUpperCase()}</span><span className="text-success">+{v}</span></div>
              ))}
            </div>
            <div className="item-actions mt-lg">
              {selectedItem.is_equipped ? (
                <button className="btn btn-ghost btn-full" onClick={() => handleUnequip(selectedItem.id)}>Unequip</button>
              ) : selectedItem.type === 'consumable' ? (
                <button className="btn btn-nature btn-full" onClick={() => handleUse(selectedItem.id)}>Use</button>
              ) : (
                <button className="btn btn-gold btn-full" onClick={() => handleEquip(selectedItem.id)}>Equip</button>
              )}
              <button className="btn btn-danger btn-full mt-md" onClick={() => handleDiscard(selectedItem.id)}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
