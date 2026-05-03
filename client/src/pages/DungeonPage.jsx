import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import api from '../utils/api';
import { ROOM_ICONS, ROOM_LABELS } from '../data/gameData';
import './DungeonPage.css';

export default function DungeonPage() {
  const { charId } = useParams();
  const navigate = useNavigate();
  const { currentCharacter, setCurrentCharacter, setCombatState } = useGame();
  const [floor, setFloor] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(-1);
  const [eventModal, setEventModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);

  useEffect(() => { loadFloor(); }, [charId]);

  const loadFloor = async () => {
    try {
      const data = await api.getFloor(parseInt(charId));
      setFloor(data.floor);
      setCurrentRoom(data.currentRoom);
      setCurrentCharacter(data.character);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const moveToRoom = async (roomIndex) => {
    if (moving) return;
    setMoving(true);
    try {
      const data = await api.moveRoom(parseInt(charId), roomIndex);
      setCurrentRoom(roomIndex);
      setCurrentCharacter(data.character);

      if (data.enemy) {
        // Combat encounter
        const combatData = await api.startCombat(parseInt(charId), data.enemy);
        setCombatState(combatData.combatState);
        navigate(`/combat/${charId}`);
        return;
      }

      // Non-combat event
      setEventModal({
        room: data.room,
        events: data.events,
        loot: data.loot,
        character: data.character
      });
    } catch (err) { console.error(err); }
    finally { setMoving(false); }
  };

  const handleNextFloor = async () => {
    setLoading(true);
    try {
      const data = await api.nextFloor(parseInt(charId));
      if (data.completed) {
        navigate(`/summary/${charId}`);
        return;
      }
      setFloor(data.floor);
      setCurrentRoom(0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    try {
      await api.saveDungeon(parseInt(charId));
      alert('Checkpoint saved!');
    } catch (err) { console.error(err); }
  };

  const isLastRoom = floor && currentRoom >= floor.rooms.length - 1;

  if (loading) return <div className="loader-container"><div className="loader"></div><p>Descending into the dungeon...</p></div>;
  if (!floor) return <div className="loader-container"><p>Failed to load dungeon.</p></div>;

  const char = currentCharacter;
  const hpPct = char ? (char.hp / char.max_hp) * 100 : 0;
  const spPct = char ? (char.sp / char.max_sp) * 100 : 0;

  return (
    <div className="dungeon-page animate-fade-in">
      <div className="dungeon-header">
        <div>
          <h2 className="page-title">🗺️ {floor.name}</h2>
          <p className="page-subtitle">{floor.description}</p>
        </div>
        <div className="dungeon-floor-badge">Floor {floor.id}</div>
      </div>

      {char && (
        <div className="dungeon-status panel">
          <div className="status-bars">
            <div className="status-bar-wrap">
              <span className="status-label">❤️ HP</span>
              <div className="stat-bar stat-bar-hp"><div className="stat-bar-fill" style={{ width: `${hpPct}%` }}></div>
                <span className="stat-bar-label">{char.hp}/{char.max_hp}</span></div>
            </div>
            <div className="status-bar-wrap">
              <span className="status-label">💎 SP</span>
              <div className="stat-bar stat-bar-sp"><div className="stat-bar-fill" style={{ width: `${spPct}%` }}></div>
                <span className="stat-bar-label">{char.sp}/{char.max_sp}</span></div>
            </div>
          </div>
          <div className="status-info">
            <span>💰 {char.gold} gold</span>
            <span>⭐ Lv.{char.level}</span>
            {char.stat_points > 0 && (
              <button className="btn btn-gold btn-sm" onClick={() => navigate(`/levelup/${charId}`)}>
                📊 Level Up ({char.stat_points} pts)
              </button>
            )}
          </div>
          <div className="status-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/inventory/${charId}`)}>🎒 Inventory</button>
            <button className="btn btn-ghost btn-sm" onClick={handleSave}>💾 Save</button>
          </div>
        </div>
      )}

      <div className="room-map">
        <div className="room-path">
          {floor.rooms.map((room, i) => {
            const isVisited = i < currentRoom;
            const isCurrent = i === currentRoom;
            const isNext = i === currentRoom + 1;
            const isLocked = i > currentRoom + 1;

            return (
              <div key={i} className="room-node-wrap">
                {i > 0 && <div className={`room-connector ${isVisited ? 'visited' : ''}`}></div>}
                <button
                  className={`room-node ${isVisited ? 'visited' : ''} ${isCurrent ? 'current' : ''} ${isNext ? 'next' : ''} ${isLocked ? 'locked' : ''}`}
                  onClick={() => isNext ? moveToRoom(i) : null}
                  disabled={!isNext || moving}
                  title={`${ROOM_LABELS[room.type]}: ${room.description}`}
                  id={`room-${i}`}
                >
                  <span className="room-icon">{ROOM_ICONS[room.type]}</span>
                  <span className="room-label">{ROOM_LABELS[room.type]}</span>
                  {isNext && <span className="room-enter-hint">Click to enter</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {isLastRoom && (
        <div className="floor-complete panel text-center">
          <h3 className="text-gold">🎉 Floor Complete!</h3>
          <p className="text-dim">You've cleared all rooms on this floor.</p>
          <button className="btn btn-gold btn-lg" onClick={handleNextFloor} id="next-floor-btn">
            ⬇️ Descend to Floor {floor.id + 1}
          </button>
        </div>
      )}

      {eventModal && (
        <div className="modal-overlay" onClick={() => setEventModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="event-icon">{ROOM_ICONS[eventModal.room.type]}</div>
            <h3 className="modal-title">{ROOM_LABELS[eventModal.room.type]}</h3>
            <p className="event-description">{eventModal.room.description}</p>
            {eventModal.events.map((evt, i) => (
              <div key={i} className={`event-message event-${evt.type}`}>{evt.message}</div>
            ))}
            {eventModal.loot && (
              <div className="event-loot">
                <p className="text-gold">💰 +{eventModal.loot.gold} gold</p>
                {eventModal.loot.items.map((item, i) => (
                  <div key={i} className={`loot-item badge-${item.rarity}`}>
                    {item.name} <span className={`badge badge-${item.rarity}`}>{item.rarity}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-gold btn-full mt-lg" onClick={() => setEventModal(null)}>Continue</button>
          </div>
        </div>
      )}
    </div>
  );
}
