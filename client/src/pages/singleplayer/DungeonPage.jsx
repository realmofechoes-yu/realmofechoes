import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import { useAuth } from '../../context/AuthContext';
import { useAudio } from '../../context/AudioContext';
import api from '../../utils/api';
import { ROOM_ICONS, ROOM_LABELS } from '../../data/gameData';

export default function DungeonPage() {
  const { charId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { 
    currentCharacter, setCurrentCharacter, 
    setCombatState
  } = useGame();
  
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
    loadSinglePlayerFloor();
  }, [charId]);

  const loadSinglePlayerFloor = async () => {
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
        const combatData = await api.startCombat(parseInt(charId), data.enemy);
        setCombatState(combatData.combatState);
        navigate(`/singleplayer/combat/${charId}`);
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

  const handleNextFloor = async () => {
    if (moving) return;
    setLoading(true);
    try {
      const data = await api.nextFloor(parseInt(charId));
      if (data.completed) {
        navigate(`/singleplayer/summary/${charId}`);
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

  if (currentCharacter && !currentCharacter.is_alive) {
    return (
      <div className="max-w-2xl mx-auto p-12 mt-20 bg-dark-surface/80 backdrop-blur-xl border border-red-500/30 rounded-2xl text-center shadow-[0_0_50px_rgba(239,68,68,0.15)] animate-fade-in">
        <div className="w-24 h-24 bg-red-900/20 border border-red-500/50 rounded-full flex items-center justify-center mx-auto mb-8 text-4xl shadow-glow-red">💀</div>
        <h2 className="text-4xl text-red-500 font-title mb-4 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">The Echoes Claim You</h2>
        <p className="text-gray-400 font-serif italic mb-10 text-lg">Your physical form has been destroyed, but your spirit lingers in the realm. Will you pay the price to return?</p>
        <button 
          className="btn btn-gold shadow-glow-gold !py-4 !px-12 !text-xl" 
          onClick={() => navigate(`/singleplayer/combat/${charId}`)}
        >
          Return to Death Screen
        </button>
      </div>
    );
  }

  if (loading) {
    return <div className="max-w-5xl mx-auto p-8 animate-fade-in text-center flex flex-col items-center justify-center min-h-[60vh]"><div className="w-12 h-12 border-4 border-dark-border border-t-gold rounded-full animate-spin mb-4"></div><p className="text-gray-400 font-serif italic">Descending into the dungeon...</p></div>;
  }
  if (!floor) return <div className="max-w-5xl mx-auto p-8 text-center text-red-400">Failed to load dungeon.</div>;

  const char = currentCharacter;
  const hpPct = char ? (char.hp / char.max_hp) * 100 : 0;
  const spPct = char ? (char.sp / char.max_sp) * 100 : 0;

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
          {char && (
            <div className="panel bg-dark-surface/80 border-gold/20 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
              
              <div className="flex-1 w-full space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400 w-12 flex-shrink-0 text-right">HP</span>
                  <div className="flex-1 h-4 bg-dark-bg rounded-full overflow-hidden border border-dark-border relative shadow-inner">
                    <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-health to-red-400 transition-all duration-500" style={{ width: `${hpPct}%` }}></div>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white tracking-widest drop-shadow-md">
                      {char.hp}/{char.max_hp}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400 w-12 flex-shrink-0 text-right">SP</span>
                  <div className="flex-1 h-4 bg-dark-bg rounded-full overflow-hidden border border-dark-border relative shadow-inner">
                    <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-mana to-blue-300 transition-all duration-500" style={{ width: `${spPct}%` }}></div>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white tracking-widest drop-shadow-md">
                      {char.sp}/{char.max_sp}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-6 px-4 border-l border-dark-border/50">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase text-gray-500 font-bold mb-1">Gold</span>
                  <span className="font-title text-gold font-bold">💰 {char.gold}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase text-gray-500 font-bold mb-1">Level</span>
                  <span className="font-title text-gray-200 font-bold">⭐ {char.level}</span>
                </div>
                {char.stat_points > 0 && (
                  <button className="btn btn-gold !py-1 !px-3 !text-xs animate-pulse-slow ml-2" onClick={() => navigate(`/singleplayer/levelup/${charId}`)}>
                    Level Up ({char.stat_points})
                  </button>
                )}
              </div>
              
              <div className="flex flex-row md:flex-col items-center gap-3 w-full md:w-auto">
                <button className="btn btn-ghost w-full !py-2" onClick={() => navigate(`/singleplayer/inventory/${charId}`)}>🎒 Inventory</button>
                <button className="btn btn-ghost w-full !py-2 border border-dark-border/50 hover:border-blue-500/50 hover:text-blue-400" onClick={handleSave}>💾 Save</button>
              </div>
            </div>
          )}

          <div className="panel bg-dark-surface/40 border-dark-border/50 overflow-x-auto py-16 px-8 relative custom-scrollbar">
            <div className="flex items-center min-w-max gap-16 px-4">
              {floor.rooms.map((room, i) => {
                const isVisited = i < currentRoom;
                const isCurrent = i === currentRoom;
                const isNext = i === currentRoom + 1;
                
                const canClick = isNext;

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
                
                return (
                  <div key={i} className="relative flex items-center">
                    {i > 0 && (
                      <div className={`absolute right-full w-16 h-1.5 top-1/2 -translate-y-1/2 transition-colors duration-500 rounded-full ${isVisited || isCurrent ? 'bg-gold shadow-[0_0_10px_rgba(255,183,3,0.5)]' : 'bg-dark-border/50'}`}></div>
                    )}
                    <button
                      className={`w-28 h-28 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all duration-300 flex-shrink-0 relative ${nodeStyle}`}
                      onClick={() => canClick ? moveToRoom(i) : null}
                      disabled={(!isNext && !isCurrent) || moving}
                      title={`${ROOM_LABELS[room.type]}: ${room.description}`}
                      id={`room-${i}`}
                    >
                      <span className={`text-4xl transition-all duration-300 ${iconStyle}`}>{ROOM_ICONS[room.type]}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest">{ROOM_LABELS[room.type]}</span>
                      
                      {canClick && <span className="absolute -bottom-8 w-max text-[10px] text-yellow-500 font-bold uppercase tracking-widest animate-pulse">Click to enter</span>}
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
              <button className="btn btn-gold shadow-glow-gold !py-4 !px-8 !text-lg mx-auto" onClick={handleNextFloor} id="next-floor-btn" disabled={moving}>
                ⬇️ Descend to Floor {floor.id + 1}
              </button>
            </div>
          )}
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
                  <span>+{eventModal.loot.gold} 💰</span>
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
              <button className="btn btn-gold w-full !py-3 shadow-glow-gold" onClick={() => setEventModal(null)}>Continue Journey</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
