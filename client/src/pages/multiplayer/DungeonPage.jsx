import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import { useAuth } from '../../context/AuthContext';
import { useSocketContext } from '../../context/SocketContext';
import { useSocketEvent, useSocketEmit } from '../../hooks/useSocket';
import { useAudio } from '../../context/AudioContext';
import { ROOM_ICONS, ROOM_LABELS } from '../../data/gameData';
import PartyPanel from '../../components/Party/PartyPanel';

export default function DungeonPage() {
  const { charId, sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { 
    currentCharacter, setCurrentCharacter, 
    partyPlayers, setPartyPlayers,
    isHost, setIsHost,
    setCoopCombatState,
    setCoopSessionId, setCoopCharacterId
  } = useGame();
  
  const { connected } = useSocketContext();
  const { emit, emitNoAck } = useSocketEmit();

  const [floor, setFloor] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(-1);
  const [eventModal, setEventModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const { playTrack } = useAudio();

  useEffect(() => {
    playTrack('mysterious_dungeon.mp3');
  }, [playTrack]);

  useEffect(() => {
    if (connected && sessionId) {
      setCoopSessionId(sessionId);
      setCoopCharacterId(charId);
      syncCoopSession();
    }
  }, [charId, sessionId, connected]);

  const syncCoopSession = async () => {
    try {
      const res = await emit('session:sync', { sessionId });
      setFloor(res.floor);
      setCurrentRoom(res.session.currentRoom);
      
      const me = res.characters.find(c => c.userId === user.id);
      if (me) setCurrentCharacter(me.character);

      setPartyPlayers(res.characters);
      
      setIsHost(res.players?.[0]?.userId === user.id); // fallback
      if (res.lobby?.hostUserId) setIsHost(res.lobby.hostUserId === user.id);

      // If combat is already active, redirect there
      if (res.isCombatActive) {
        setCoopCombatState(res.combatState);
        navigate(`/multiplayer/combat/${charId}/${sessionId}`);
      }
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

    if (!data.enemy) {
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
    navigate(`/multiplayer/summary/${charId}/${sessionId}`);
  });

  useSocketEvent('dungeon:event_dismissed', () => {
    setEventModal(null);
  });

  useSocketEvent('combat:started', (data) => {
    setCoopCombatState(data.combatState);
    navigate(`/multiplayer/combat/${charId}/${sessionId}`);
  });

  const moveToRoom = async (roomIndex) => {
    if (moving || !isHost) return; 

    setMoving(true);
    try {
      const res = await emit('dungeon:move', { sessionId, roomIndex });
      if (res.result.enemy && isHost) {
        // If we hit an enemy, host initiates combat
        await emit('combat:start_coop', { sessionId, enemy: res.result.enemy });
      }
    } catch (err) {
      console.error(err);
      setMoving(false);
    }
  };

  const handleNextFloor = async () => {
    if (moving || !isHost) return;
    setLoading(true);
    try {
      await emit('dungeon:next_floor', { sessionId });
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const isLastRoom = floor && currentRoom >= floor.rooms.length - 1;

  if (loading || !connected) {
    return <div className="max-w-5xl mx-auto p-8 animate-fade-in text-center flex flex-col items-center justify-center min-h-[60vh]"><div className="w-12 h-12 border-4 border-dark-border border-t-gold rounded-full animate-spin mb-4"></div><p className="text-gray-400 font-serif italic">Syncing with party...</p></div>;
  }
  if (!floor) return <div className="max-w-5xl mx-auto p-8 text-center text-red-400">Failed to load dungeon.</div>;

  // Format party for PartyPanel
  const formattedParty = partyPlayers.map(p => ({
    userId: p.userId,
    username: p.username || p.character.name,
    class: p.character.class,
    level: p.character.level,
    hp: p.character.hp,
    maxHp: p.character.max_hp,
    sp: p.character.sp,
    maxSp: p.character.max_sp,
    isAlive: p.character.is_alive
  }));

  return (
    <div className="relative -m-4 md:-m-8 p-4 md:p-8 min-h-[calc(100vh-4rem)]">
      {/* Dungeon Background */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
        style={{ 
          backgroundImage: `url('/image2.png')`,
          filter: 'brightness(0.5) saturate(1.0)'
        }}
      />
      
      {/* Atmospheric Overlays */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-dark-bg/20 via-transparent to-dark-bg/70 pointer-events-none" />
      <div className="fixed inset-0 z-0 backdrop-blur-[2px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-title font-bold text-gold drop-shadow-md flex items-center gap-3">
            <span className="text-4xl">🗺️</span> {floor.name}
          </h2>
          <p className="text-gray-400 font-serif italic mt-1 ml-1">{floor.description}</p>
        </div>
        <div className="bg-dark-surface/60 border border-gold/50 px-6 py-2 rounded-full font-title font-bold text-xl text-gold shadow-glow-gold">
          Floor {floor.id}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 flex flex-col gap-8">
          <div className="panel bg-dark-surface/40 border-dark-border/50 overflow-x-auto py-16 px-8 relative custom-scrollbar">
            <div className="flex items-center min-w-max gap-16 px-4">
              {floor.rooms.map((room, i) => {
                const isVisited = i < currentRoom;
                const isCurrent = i === currentRoom;
                const isNext = i === currentRoom + 1;
                
                // Only host can click next in co-op
                const canClick = isNext && isHost;

                // Styling logic
                let nodeStyle = "border-dark-border text-gray-600 opacity-50 cursor-not-allowed";
                let iconStyle = "grayscale opacity-50";
                
                if (isVisited) {
                  nodeStyle = "border-gold/50 text-gold/70 bg-dark-bg/80 cursor-default shadow-inner";
                  iconStyle = "";
                } else if (isCurrent) {
                  nodeStyle = "border-gold text-gold shadow-glow-gold scale-110 bg-gold/10 z-20";
                  iconStyle = "drop-shadow-[0_0_8px_rgba(255,183,3,0.8)]";
                } else if (isNext) {
                  nodeStyle = "border-yellow-500/50 bg-dark-surface hover:border-gold hover:shadow-glow-gold hover:-translate-y-2 cursor-pointer text-gray-300 hover:text-gold z-10";
                  iconStyle = "drop-shadow-md";
                }
                
                if (!isHost && isNext) {
                  nodeStyle = "border-yellow-500/30 text-gray-400 opacity-80 cursor-not-allowed";
                }

                return (
                  <div key={i} className="relative flex items-center">
                    {i > 0 && (
                      <div className={`absolute right-full w-16 h-1.5 top-1/2 -translate-y-1/2 transition-colors duration-500 rounded-full ${isVisited || isCurrent ? 'bg-gold shadow-[0_0_10px_rgba(255,183,3,0.5)]' : 'bg-dark-border/50'}`}></div>
                    )}
                    <button
                      className={`w-28 h-28 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all duration-300 flex-shrink-0 relative ${nodeStyle}`}
                      onClick={() => canClick ? moveToRoom(i) : null}
                      disabled={(!isNext && !isCurrent) || moving || (!isHost && isNext)}
                      title={`${ROOM_LABELS[room.type]}: ${room.description}`}
                      id={`room-${i}`}
                    >
                      <span className={`text-4xl transition-all duration-300 ${iconStyle}`}>{ROOM_ICONS[room.type]}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest">{ROOM_LABELS[room.type]}</span>
                      
                      {canClick && <span className="absolute -bottom-8 w-max text-[10px] text-yellow-500 font-bold uppercase tracking-widest animate-pulse">Click to enter</span>}
                      {isNext && !isHost && <span className="absolute -bottom-8 w-max text-[10px] text-gray-500 font-bold uppercase tracking-widest">Waiting for host</span>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {isLastRoom && (
            <div className="panel bg-gold/10 border-gold/50 text-center py-12 relative overflow-hidden animate-fade-in">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gold/5 pointer-events-none"></div>
              <h3 className="font-title text-4xl text-gold mb-3 drop-shadow-md">🎉 Floor Complete!</h3>
              <p className="text-gray-300 font-serif italic mb-8">You've cleared all rooms on this floor. The path deeper reveals itself.</p>
              {isHost ? (
                <button className="btn btn-gold shadow-glow-gold !py-4 !px-8 !text-lg mx-auto" onClick={() => {
                  handleNextFloor();
                  // Fallback: If socket event isn't received within 1s, force sync/refresh
                  setTimeout(() => {
                    syncCoopSession();
                    setLoading(false);
                  }, 1500);
                }} id="next-floor-btn" disabled={moving}>
                  ⬇️ Descend to Floor {floor.id + 1}
                </button>
              ) : (
                <p className="text-gray-400 font-bold uppercase tracking-widest mt-4">Waiting for host to descend...</p>
              )}
            </div>
          )}
        </div>

        <div className="w-full lg:w-[340px] flex flex-col gap-6">
          <PartyPanel players={formattedParty} myUserId={user.id} />
          <div className="panel bg-dark-surface/60 border-dark-border/50 flex flex-col gap-3">
            <button className="btn btn-ghost w-full !py-3" onClick={() => navigate(`/multiplayer/inventory/${charId}/${sessionId}`)}>🎒 Party Inventory</button>
            <button className="btn btn-ghost w-full !py-3 border border-dark-border/50 hover:bg-red-900/20 hover:text-red-400 hover:border-red-900/50" onClick={() => {
              if (window.confirm('Are you sure you want to abandon the co-op session?')) {
                emitNoAck('lobby:leave');
                setCoopCombatState(null);
                setCoopSessionId(null);
                setCoopCharacterId(null);
                navigate('/dashboard/multiplayer');
              }
            }}>🚪 Abandon Co-op</button>
          </div>
        </div>
      </div>

      {eventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setEventModal(null)}>
          <div className="panel w-full max-w-md flex flex-col shadow-2xl relative border-2 border-gold/30 bg-dark-surface animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6 pt-4">
              <div className="text-6xl drop-shadow-lg mb-4 inline-block transform hover:scale-110 transition-transform duration-300">{ROOM_ICONS[eventModal.room.type]}</div>
              <h3 className="font-title text-3xl font-bold text-gold drop-shadow-sm mb-2">{ROOM_LABELS[eventModal.room.type]}</h3>
              <p className="text-gray-400 font-serif italic">"{eventModal.room.description}"</p>
            </div>
            
            <div className="bg-dark-bg/60 rounded-lg p-4 border border-dark-border mb-6 flex flex-col gap-3">
              {eventModal.events.map((evt, i) => (
                <div key={i} className={`p-3 rounded border text-sm font-serif italic ${evt.type === 'danger' ? 'bg-red-900/20 border-red-500/30 text-red-300' : evt.type === 'success' ? 'bg-green-900/20 border-green-500/30 text-green-300' : 'bg-dark-surface border-dark-border text-gray-300'}`}>
                  {evt.message}
                </div>
              ))}
            </div>
            
            {eventModal.loot && (
              <div className="mb-6 pt-4 border-t border-dark-border/50 flex flex-col gap-2">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center mb-2">Loot Acquired</h4>
                <div className="flex justify-between items-center bg-gold/10 p-3 rounded border border-gold/30 font-bold text-gold">
                  <span>Gold Found</span>
                  <span>+{eventModal.loot.gold} 💰 <span className="text-[10px] font-normal uppercase opacity-70 ml-1">(split)</span></span>
                </div>
                {eventModal.loot.items.map((item, i) => {
                  const getRarityBadge = (r) => {
                    switch(r) {
                      case 'uncommon': return 'bg-green-900/40 text-green-400 border border-green-500/50';
                      case 'rare': return 'bg-blue-900/40 text-blue-400 border border-blue-500/50';
                      case 'epic': return 'bg-purple-900/40 text-purple-400 border border-purple-500/50';
                      case 'legendary': return 'bg-gold/40 text-gold border border-gold shadow-glow-gold';
                      default: return 'bg-gray-800 text-gray-400 border border-gray-600';
                    }
                  };
                  return (
                    <div key={i} className="flex justify-between items-center bg-dark-surface p-3 rounded border border-dark-border/50 text-sm font-bold text-gray-200">
                      <span>{item.name}</span>
                      <span className={`text-[9px] uppercase px-2 py-0.5 rounded ${getRarityBadge(item.rarity)}`}>{item.rarity}</span>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="mt-auto pt-2">
              {isHost ? (
                <button className="btn btn-gold w-full !py-3 shadow-glow-gold" onClick={() => {
                  emitNoAck('dungeon:dismiss_event', { sessionId });
                  setEventModal(null);
                  // Global fallback: emit usually works, but let's ensure we can move
                  setTimeout(() => {
                    syncCoopSession();
                  }, 1000);
                }}>Continue Journey</button>
              ) : (
                <p className="text-gray-500 text-sm font-bold uppercase tracking-widest text-center py-3 bg-dark-bg rounded border border-dark-border">Waiting for host...</p>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
