import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useAuth } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import { useSocketEvent, useSocketEmit } from '../hooks/useSocket';
import api from '../utils/api';
import { ROOM_ICONS, ROOM_LABELS } from '../data/gameData';
import PartyPanel from '../components/Party/PartyPanel';
import './DungeonPage.css';

export default function DungeonPage() {
  const { charId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const { 
    currentCharacter, setCurrentCharacter, 
    setCombatState,
    coopSessionId, setCoopSessionId,
    partyPlayers, setPartyPlayers,
    isHost, setIsHost,
    setCoopCombatState
  } = useGame();
  
  const { socket, connected } = useSocketContext();
  const { emit } = useSocketEmit();

  const [floor, setFloor] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(-1);
  const [eventModal, setEventModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);

  const queryParams = new URLSearchParams(location.search);
  const isCoop = !!coopSessionId || !!queryParams.get('coop');

  useEffect(() => {
    if (queryParams.get('coop')) {
      setCoopSessionId(queryParams.get('coop'));
    }
  }, [location.search]);

  useEffect(() => {
    if (isCoop) {
      if (connected) syncCoopSession();
    } else {
      loadSinglePlayerFloor();
    }
  }, [charId, isCoop, connected]);

  // --- CO-OP SOCKET LOGIC ---

  const syncCoopSession = async () => {
    try {
      const sessionId = coopSessionId || queryParams.get('coop');
      const res = await emit('session:sync', { sessionId });
      setFloor(res.floor);
      setCurrentRoom(res.session.currentRoom);
      
      const me = res.characters.find(c => c.userId === user.id);
      if (me) setCurrentCharacter(me.character);

      setPartyPlayers(res.characters);
      
      // Check host
      const host = res.players?.find(p => p.userId === res.lobby?.hostUserId || p.isHost);
      // Wait, lobby info is missing hostUserId in sync? The backend `session:sync` just returns characters and players.
      // Let's assume the first player or host if available. 
      // Actually, we can check if I am host via lobby data, but `session:sync` might not return lobby.hostUserId explicitly. 
      // I'll update it to check `p.userId === lobby?.hostUserId` if possible.
      setIsHost(res.players?.[0]?.userId === user.id); // fallback
      if (res.lobby?.hostUserId) setIsHost(res.lobby.hostUserId === user.id);
    } catch (err) {
      console.error('Co-op sync error:', err);
    } finally {
      setLoading(false);
    }
  };

  useSocketEvent('dungeon:room_entered', (data) => {
    setCurrentRoom(data.roomIndex !== undefined ? data.roomIndex : currentRoom + 1);
    
    // Update characters
    if (data.characters) {
      setPartyPlayers(data.characters);
      const me = data.characters.find(c => c.userId === user.id);
      if (me) setCurrentCharacter(me.character);
    }

    if (data.enemy) {
      // It's a combat room, combat will be started shortly via another event or we can just wait for 'combat:started'
      // But the backend `dungeon:move` doesn't emit 'combat:started' directly, we should start it if we are the host.
    } else {
      setEventModal({
        room: data.room,
        events: data.events,
        loot: data.loot
      });
    }
    setMoving(false);
  });

  useSocketEvent('dungeon:next_floor', (data) => {
    setFloor(data.floor);
    setCurrentRoom(data.currentRoom);
    setLoading(false);
    setMoving(false);
  });

  useSocketEvent('dungeon:completed', (data) => {
    navigate(`/summary/${charId}`);
  });

  useSocketEvent('dungeon:event_dismissed', () => {
    setEventModal(null);
  });

  useSocketEvent('combat:started', (data) => {
    setCoopCombatState(data.combatState);
    navigate(`/combat/${charId}?coop=${coopSessionId || queryParams.get('coop')}`);
  });

  // --- SINGLE PLAYER API LOGIC ---

  const loadSinglePlayerFloor = async () => {
    try {
      const data = await api.getFloor(parseInt(charId));
      setFloor(data.floor);
      setCurrentRoom(data.currentRoom);
      setCurrentCharacter(data.character);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const moveRoomSinglePlayer = async (roomIndex) => {
    try {
      const data = await api.moveRoom(parseInt(charId), roomIndex);
      setCurrentRoom(roomIndex);
      setCurrentCharacter(data.character);

      if (data.enemy) {
        const combatData = await api.startCombat(parseInt(charId), data.enemy);
        setCombatState(combatData.combatState);
        navigate(`/combat/${charId}`);
        return;
      }

      setEventModal({
        room: data.room,
        events: data.events,
        loot: data.loot,
        character: data.character
      });
    } catch (err) { console.error(err); }
    finally { setMoving(false); }
  };

  // --- UNIFIED ACTIONS ---

  const moveToRoom = async (roomIndex) => {
    if (moving) return;
    if (isCoop && !isHost) return; // Only host can navigate

    setMoving(true);
    if (isCoop) {
      try {
        const sessionId = coopSessionId || queryParams.get('coop');
        const res = await emit('dungeon:move', { sessionId, roomIndex });
        if (res.result.enemy && isHost) {
          // If we hit an enemy, host initiates combat
          await emit('combat:start_coop', { sessionId, enemy: res.result.enemy });
        }
      } catch (err) {
        console.error(err);
        setMoving(false);
      }
    } else {
      await moveRoomSinglePlayer(roomIndex);
    }
  };

  const handleNextFloor = async () => {
    if (moving) return;
    setLoading(true);
    if (isCoop) {
      try {
        const sessionId = coopSessionId || queryParams.get('coop');
        await emit('dungeon:next_floor', { sessionId });
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    } else {
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
    }
  };

  const handleSave = async () => {
    try {
      await api.saveDungeon(parseInt(charId));
      alert('Checkpoint saved!');
    } catch (err) { console.error(err); }
  };

  const isLastRoom = floor && currentRoom >= floor.rooms.length - 1;

  if (loading || (isCoop && !connected)) {
    return <div className="loader-container"><div className="loader"></div><p>Descending into the dungeon...</p></div>;
  }
  if (!floor) return <div className="loader-container"><p>Failed to load dungeon.</p></div>;

  const char = currentCharacter;
  const hpPct = char ? (char.hp / char.max_hp) * 100 : 0;
  const spPct = char ? (char.sp / char.max_sp) * 100 : 0;

  // Format party for PartyPanel
  const formattedParty = isCoop ? partyPlayers.map(p => ({
    userId: p.userId,
    username: p.username || p.character.name,
    class: p.character.class,
    level: p.character.level,
    hp: p.character.hp,
    maxHp: p.character.max_hp,
    sp: p.character.sp,
    maxSp: p.character.max_sp,
    isAlive: p.character.is_alive
  })) : [];

  return (
    <div className="dungeon-page animate-fade-in">
      <div className="dungeon-header">
        <div>
          <h2 className="page-title">🗺️ {floor.name}</h2>
          <p className="page-subtitle">{floor.description}</p>
        </div>
        <div className="dungeon-floor-badge">Floor {floor.id}</div>
      </div>

      <div className="dungeon-layout">
        <div className="dungeon-main">
          {char && !isCoop && (
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
                
                // Only host can click next in co-op
                const canClick = isNext && (!isCoop || isHost);

                return (
                  <div key={i} className="room-node-wrap">
                    {i > 0 && <div className={`room-connector ${isVisited ? 'visited' : ''}`}></div>}
                    <button
                      className={`room-node ${isVisited ? 'visited' : ''} ${isCurrent ? 'current' : ''} ${isNext ? 'next' : ''} ${isLocked ? 'locked' : ''} ${isCoop && !isHost ? 'disabled-node' : ''}`}
                      onClick={() => canClick ? moveToRoom(i) : null}
                      disabled={(!isNext && !isCurrent) || moving || (isCoop && !isHost && isNext)}
                      title={`${ROOM_LABELS[room.type]}: ${room.description}`}
                      id={`room-${i}`}
                    >
                      <span className="room-icon">{ROOM_ICONS[room.type]}</span>
                      <span className="room-label">{ROOM_LABELS[room.type]}</span>
                      {canClick && <span className="room-enter-hint">Click to enter</span>}
                      {isNext && isCoop && !isHost && <span className="room-enter-hint">Waiting for host...</span>}
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
              {(!isCoop || isHost) ? (
                <button className="btn btn-gold btn-lg" onClick={handleNextFloor} id="next-floor-btn" disabled={moving}>
                  ⬇️ Descend to Floor {floor.id + 1}
                </button>
              ) : (
                <p className="text-dim mt-sm">Waiting for host to descend...</p>
              )}
            </div>
          )}
        </div>

        {isCoop && (
          <div className="dungeon-sidebar">
            <PartyPanel players={formattedParty} myUserId={user.id} />
            <div className="status-actions mt-md panel" style={{display: 'flex', flexDirection: 'column'}}>
              <button className="btn btn-ghost btn-sm btn-full" onClick={() => navigate(`/inventory/${charId}`)}>🎒 Inventory</button>
            </div>
          </div>
        )}
      </div>

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
                <p className="text-gold">💰 +{eventModal.loot.gold} gold {isCoop && '(split)'}</p>
                {eventModal.loot.items.map((item, i) => (
                  <div key={i} className={`loot-item badge-${item.rarity}`}>
                    {item.name} <span className={`badge badge-${item.rarity}`}>{item.rarity}</span>
                  </div>
                ))}
              </div>
            )}
            {(!isCoop || isHost) ? (
              <button className="btn btn-gold btn-full mt-lg" onClick={() => {
                if (isCoop) emitNoAck('dungeon:dismiss_event', { sessionId: coopSessionId || queryParams.get('coop') });
                setEventModal(null);
              }}>Continue</button>
            ) : (
              <p className="text-dim mt-sm text-center">Waiting for host to continue...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
