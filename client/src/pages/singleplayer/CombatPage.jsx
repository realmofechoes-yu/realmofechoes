import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import { useAudio } from '../../context/AudioContext';
import api from '../../utils/api';
import { CLASS_INFO } from '../../data/gameData';

export default function CombatPage() {
  const { charId } = useParams();
  const navigate = useNavigate();
  
  const { 
    combatState, setCombatState, 
    currentCharacter, setCurrentCharacter
  } = useGame();

  const [turnLog, setTurnLog] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [damageNumbers, setDamageNumbers] = useState([]);
  const [enemyShake, setEnemyShake] = useState(false);
  const [playerShake, setPlayerShake] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [showItems, setShowItems] = useState(false);
  const { playTrack } = useAudio();
  const logRef = useRef(null);
  const dmgIdRef = useRef(0);

  useEffect(() => {
    const syncCombat = async () => {
      if (!combatState) {
        try {
          const data = await api.getActiveCombat(charId);
          setCombatState(data.combatState);
        } catch (err) {
          navigate(`/singleplayer/dungeon/${charId}`);
        }
      }
    };

    syncCombat();
    loadConsumables();
  }, [charId]);

  const state = combatState;
  
  useEffect(() => {
    if (state) {
      const enemyData = state.enemy;
      if (enemyData) {
        if (enemyData.isBoss) playTrack('decisive_battle.mp3');
        else playTrack('prepare_battle.mp3');
      }
    }
  }, [state, playTrack]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [allLogs]);

  const loadConsumables = async () => {
    try {
      const data = await api.getInventory(parseInt(charId), { type: 'consumable' });
      setInventory(data.items || []);
    } catch (e) { /* ignore */ }
  };

  const showDamage = (amount, type = 'damage', target = 'enemy') => {
    const id = ++dmgIdRef.current;
    let x;
    if (target === 'enemy') {
      x = 60 + Math.random() * 20;
    } else {
      x = 20 + Math.random() * 20; 
    }
    setDamageNumbers(prev => [...prev, { id, amount, type, x }]);
    setTimeout(() => setDamageNumbers(prev => prev.filter(d => d.id !== id)), 1500);
  };

  const shakePlayer = () => {
    setPlayerShake(true);
    setTimeout(() => setPlayerShake(false), 500);
  };

  const processAction = async (action, skillKey = null, itemId = null) => {
    if (actionLoading || result) return;
    setActionLoading(true);
    setShowItems(false);

    try {
      const data = await api.combatAction(parseInt(charId), action, skillKey, itemId);
      setCombatState(data.combatState);
      setTurnLog(data.turnLog);
      setAllLogs(prev => [...prev, ...data.turnLog]);

      for (const evt of data.turnLog) {
        if (evt.type === 'player_attack' || evt.type === 'player_skill') {
          setEnemyShake(true);
          showDamage(evt.amount, evt.isCrit ? 'crit' : 'damage', 'enemy');
          setTimeout(() => setEnemyShake(false), 500);
        }
        if (evt.type === 'enemy_damage' || evt.type === 'enemy_attack') {
          shakePlayer();
          showDamage(evt.amount, 'damage', 'player');
        }
        if (evt.type === 'use_item' || evt.type === 'enemy_heal') {
          showDamage(evt.amount || '✓', 'heal', evt.type === 'enemy_heal' ? 'enemy' : 'player');
        }
      }

      if (!data.ongoing) {
        setResult(data);
        if (data.character) setCurrentCharacter(data.character);
        loadConsumables();
      }
    } catch (err) {
      setAllLogs(prev => [...prev, { type: 'error', message: err.message }]);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFlee = async () => {
    if (actionLoading || result) return;
    setActionLoading(true);
    try {
      const data = await api.flee(parseInt(charId));
      if (data.fled) {
        setAllLogs(prev => [...prev, { type: 'flee', message: 'You escaped!' }]);
        setTimeout(() => {
          setCombatState(null);
          navigate(`/singleplayer/dungeon/${charId}`);
        }, 1500);
      } else {
        setCombatState(data.combatState);
        setTurnLog(data.turnLog);
        setAllLogs(prev => [...prev, ...data.turnLog]);
        if (data.death) setResult(data);
      }
    } catch (err) { console.error(err); }
    finally { setActionLoading(false); }
  };

  if (!state) return <div className="max-w-5xl mx-auto p-8 animate-fade-in text-center flex flex-col items-center justify-center min-h-[60vh]"><div className="w-12 h-12 border-4 border-dark-border border-t-gold rounded-full animate-spin mb-4"></div><p className="text-gray-400 font-serif italic">Loading Combat...</p></div>;

  const enemy = state.enemy;
  const enemyHpPct = (enemy.hp / enemy.maxHp) * 100;
  
  const myPlayerState = { ...state.player, isAlive: state.player.hp > 0 };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 animate-fade-in">
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <h2 className="text-3xl font-title font-bold text-gold drop-shadow-md">⚔️ Combat — Round {state.turn}</h2>
        {enemy.isBoss && <span className="font-title font-bold text-sm text-red-500 bg-red-900/20 px-3 py-1 rounded-full border border-red-500/40 animate-pulse">👹 BOSS</span>}
      </div>

      <div className="relative flex flex-col md:flex-row gap-8 items-center justify-between mb-12 min-h-[300px]">
        {/* Player Side */}
        <div className="flex-1 w-full flex flex-wrap gap-4 justify-center">
          <div className={`panel w-full max-w-sm bg-dark-surface/80 border-dark-border text-center ${playerShake ? 'animate-shake' : ''} border-gold shadow-glow-gold ${!myPlayerState.isAlive ? 'opacity-50 grayscale border-red-900' : ''}`}>
            <div className="h-32 md:h-48 mb-4 flex items-center justify-center">
              {(!myPlayerState.isAlive && CLASS_INFO[myPlayerState.class]?.sprites?.dead) ? <img src={CLASS_INFO[myPlayerState.class].sprites.dead} alt={myPlayerState.name} className="max-w-full max-h-full object-contain [image-rendering:pixelated] scale-150 md:scale-[2]" /> : ((CLASS_INFO[myPlayerState.class]?.sprites?.idle || CLASS_INFO[myPlayerState.class]?.sprite) ? <img src={(enemyShake) ? (CLASS_INFO[myPlayerState.class]?.sprites?.attack || CLASS_INFO[myPlayerState.class]?.sprites?.idle || CLASS_INFO[myPlayerState.class]?.sprite) : (CLASS_INFO[myPlayerState.class]?.sprites?.idle || CLASS_INFO[myPlayerState.class]?.sprite)} alt={myPlayerState.name} className="max-w-full max-h-full object-contain drop-shadow-lg [image-rendering:pixelated] scale-150 md:scale-[2]" /> : <span className="text-6xl">{CLASS_INFO[myPlayerState.class]?.icon}</span>)}
            </div>
            <h3 className="font-title text-2xl font-bold text-gray-200 mb-1">{myPlayerState.name}</h3>
            <span className="text-sm text-gray-400 block mb-4">Lv.{myPlayerState.level} {CLASS_INFO[myPlayerState.class]?.name}</span>
            
            <div className="space-y-3">
              <div className="h-4 bg-dark-bg rounded-full overflow-hidden border border-dark-border relative shadow-inner">
                <div className="absolute top-0 left-0 h-full bg-health transition-all duration-300" style={{ width: `${(myPlayerState.hp / myPlayerState.maxHp) * 100}%` }}></div>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md">HP {myPlayerState.hp}/{myPlayerState.maxHp}</span>
              </div>
              <div className="h-4 bg-dark-bg rounded-full overflow-hidden border border-dark-border relative shadow-inner">
                <div className="absolute top-0 left-0 h-full bg-mana transition-all duration-300" style={{ width: `${(myPlayerState.sp / myPlayerState.maxSp) * 100}%` }}></div>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md">SP {myPlayerState.sp}/{myPlayerState.maxSp}</span>
              </div>
            </div>
            
            {myPlayerState.statusEffects?.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {myPlayerState.statusEffects.map((e, i) => (
                  <span key={i} className="text-[10px] text-red-400 bg-red-900/20 border border-red-500/30 px-2 py-1 rounded-full uppercase tracking-wider font-bold">🔥 {e.name || e.type} ({e.duration}t)</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="font-title text-4xl text-gray-600 drop-shadow-md py-4 md:py-0 shrink-0">VS</div>

        {/* Enemy Side */}
        <div className={`flex-1 w-full max-w-sm panel bg-dark-surface/80 border-dark-border text-center ${enemyShake ? 'animate-shake' : ''}`}>
          <div className="h-32 md:h-48 mb-4 flex items-center justify-center drop-shadow-[0_0_15px_rgba(196,75,47,0.4)]">
            {(enemy.sprites?.idle || enemy.sprite) ? <img src={(enemy.hp <= 0 && enemy.sprites?.dead) ? enemy.sprites.dead : (playerShake ? (enemy.sprites?.attack || enemy.sprites?.idle || enemy.sprite) : (enemy.sprites?.idle || enemy.sprite))} alt={enemy.name} className="max-w-full max-h-full object-contain [image-rendering:pixelated] scale-150 md:scale-[2]" /> : <span className="text-6xl">{enemy.isBoss ? '👹' : '💀'}</span>}
          </div>
          <h3 className="font-title text-2xl font-bold text-red-400 mb-1">{enemy.name}</h3>
          <p className="text-xs text-gray-500 font-serif italic mb-4">{enemy.flavorText}</p>
          
          <div className="h-4 bg-dark-bg rounded-full overflow-hidden border border-dark-border relative shadow-inner mb-4">
            <div className="absolute top-0 left-0 h-full bg-red-600 transition-all duration-300" style={{ width: `${enemyHpPct}%` }}></div>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md">HP {enemy.hp}/{enemy.maxHp}</span>
          </div>

          {enemy.statusEffects?.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {enemy.statusEffects.map((e, i) => (
                <span key={i} className="text-[10px] text-blue-400 bg-blue-900/20 border border-blue-500/30 px-2 py-1 rounded-full uppercase tracking-wider font-bold">⚡ {e.type} ({e.duration}t)</span>
              ))}
            </div>
          )}
          
          {enemy.special && (
            <div className="bg-dark-bg/60 p-3 rounded border border-dark-border mt-2">
              <span className="block text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">⚡ {enemy.special.name}</span>
              <span className="text-[10px] text-gray-400">{enemy.special.description}</span>
            </div>
          )}
        </div>

        {/* Floating damage numbers */}
        {damageNumbers.map(d => (
          <div key={d.id} className={`absolute text-3xl font-title font-bold pointer-events-none z-10 animate-float-up drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${d.type === 'damage' ? 'text-red-500' : d.type === 'crit' ? 'text-gold scale-125' : 'text-green-500'}`}
            style={{ left: `${d.x}%`, top: d.targetId ? '40%' : '50%' }}>
            {d.type === 'heal' ? `+${d.amount}` : `-${d.amount}`}
          </div>
        ))}
      </div>

      {/* Combat Log */}
      <div className="panel bg-dark-surface/40 border-dark-border/50 h-48 overflow-y-auto mb-8 custom-scrollbar" ref={logRef}>
        <h4 className="text-sm font-bold text-gold uppercase tracking-widest mb-3 border-b border-dark-border/50 pb-2">📜 Combat Log</h4>
        <div className="space-y-1.5">
          {allLogs.slice(-20).map((entry, i) => {
            let colors = "border-gray-700 text-gray-400";
            if (entry.type === 'player_attack' || entry.type === 'player_skill') colors = "border-blue-500/50 text-blue-300";
            else if (['enemy_damage', 'enemy_attack', 'enemy_special'].includes(entry.type)) colors = "border-red-500/50 text-red-400";
            else if (['victory', 'reward', 'loot'].includes(entry.type)) colors = "border-gold/50 text-gold";
            else if (entry.type === 'death') colors = "border-red-600 text-red-500 font-bold";
            else if (entry.type === 'level_up') colors = "border-gold text-yellow-300 font-bold";
            else if (['use_item', 'player_defend'].includes(entry.type)) colors = "border-green-500/50 text-green-400";

            return (
              <div key={i} className={`text-sm px-3 py-1.5 rounded bg-dark-bg/40 border-l-4 ${colors}`}>
                {entry.message}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Bar */}
      {!result ? (
        <div className="relative flex flex-wrap justify-center gap-4 bg-dark-surface/60 p-6 rounded-xl border border-dark-border">
          <button className="btn bg-red-900/60 hover:bg-red-800 text-red-100 border border-red-500/30 px-6 py-3 min-w-[140px] text-sm" onClick={() => processAction('attack')}
            disabled={actionLoading || !myPlayerState?.isAlive} id="btn-attack">
            <span className="block text-xl mb-1">⚔️</span> Attack
          </button>
          
          {/* Skills */}
          {(CLASS_INFO[myPlayerState?.class]?.skills || []).map((skill) => (
            <button key={skill.key} className="btn bg-blue-900/60 hover:bg-blue-800 text-blue-100 border border-blue-500/30 px-6 py-3 min-w-[140px] text-sm relative" onClick={() => processAction('skill', skill.key)}
              disabled={actionLoading || !myPlayerState?.isAlive || myPlayerState?.sp < skill.spCost} id={`btn-${skill.key}`}
              title={`${skill.description} (${skill.spCost} SP)`}>
              <span className="block text-xl mb-1">{skill.icon || '✨'}</span> {skill.name}
              <span className="absolute top-1 right-2 text-[10px] opacity-70 text-blue-300">{skill.spCost} SP</span>
            </button>
          ))}
          
          <button className="btn bg-gray-700/60 hover:bg-gray-600 text-gray-200 border border-gray-500/30 px-6 py-3 min-w-[140px] text-sm" onClick={() => processAction('defend')}
            disabled={actionLoading || !myPlayerState?.isAlive} id="btn-defend">
            <span className="block text-xl mb-1">🛡️</span> Defend
          </button>
          
          <div className="relative min-w-[140px]">
            <button className="btn w-full bg-green-900/60 hover:bg-green-800 text-green-100 border border-green-500/30 px-6 py-3 text-sm h-full" onClick={() => setShowItems(!showItems)}
              disabled={actionLoading || !myPlayerState?.isAlive || inventory.length === 0} id="btn-items">
              <span className="block text-xl mb-1">🧪</span> Items ({inventory.length})
            </button>
            
            {showItems && (
              <div className="absolute bottom-[calc(100%+0.5rem)] left-1/2 -translate-x-1/2 min-w-[220px] bg-dark-bg border border-dark-border rounded-lg shadow-xl z-20 flex flex-col overflow-hidden">
                <div className="text-[10px] uppercase font-bold text-gray-500 bg-dark-surface px-3 py-2 border-b border-dark-border text-center">Consumables</div>
                {inventory.map(item => (
                  <button key={item.id} className="flex justify-between items-center px-4 py-3 hover:bg-dark-surface border-b border-dark-border/50 last:border-0 text-sm transition-colors text-left" onClick={() => processAction('use_item', null, item.id)}>
                    <span className="font-bold text-gray-200">{item.name}</span>
                    <span className="text-gray-500 text-xs bg-dark-surface px-2 py-0.5 rounded">×{item.quantity}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <button className="btn btn-ghost px-6 py-3 min-w-[140px] text-sm border border-dark-border/50 hover:border-gray-500/50" onClick={handleFlee}
            disabled={actionLoading} id="btn-flee">
            <span className="block text-xl mb-1">🏃</span> Flee
          </button>
        </div>
      ) : (
        <div className="panel bg-dark-surface text-center p-12 shadow-2xl border-2 border-gold/30 animate-slide-up">
          {result.victory ? (
            <>
              <h3 className="font-title text-5xl text-gold mb-4 drop-shadow-md">🎉 Victory!</h3>
              <p className="text-gray-300 font-serif italic mb-8">{enemy.name} has been defeated!</p>
              
              {result.loot?.length > 0 && (
                <div className="bg-dark-bg/60 rounded-xl p-6 border border-dark-border max-w-md mx-auto mb-8 text-left">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 border-b border-dark-border/50 pb-2">Loot Recovered</h4>
                  <div className="space-y-3">
                    {result.loot.map((item, i) => {
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
                        <div className="flex items-center gap-3 bg-dark-surface p-3 rounded border border-dark-border/50" key={i}>
                          <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold ${getRarityBadge(item.rarity)}`}>{item.rarity}</span>
                          <span className="font-bold text-gray-200 text-sm">{item.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {result.leveledUp && (
                <div className="bg-gold/10 border border-gold/50 text-gold px-6 py-4 rounded-xl max-w-md mx-auto mb-8 animate-pulse-slow font-bold">
                  🎊 Level Up! You gained new stat points!
                </div>
              )}
              
              <button className="btn btn-gold shadow-glow-gold !py-4 !px-12 !text-lg mx-auto" onClick={() => {
                setCombatState(null);
                navigate(`/singleplayer/dungeon/${charId}`);
              }} id="btn-continue">
                Return to Dungeon
              </button>
            </>
          ) : (
            <>
              <h3 className="font-title text-5xl text-red-500 mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">💀 Defeated</h3>
              <p className="text-gray-400 font-serif italic mb-8">You have fallen to {enemy.name}...</p>
              
              {result.echoReward && (
                <div className="bg-dark-bg/80 border border-purple-500/30 p-6 rounded-xl max-w-lg mx-auto mb-8 shadow-[0_0_20px_rgba(168,85,247,0.1)]">
                  <p className="text-purple-300 font-serif italic mb-4">"{result.echoReward.lore?.text}"</p>
                  {result.echoReward.perk && (
                    <div className="bg-purple-900/20 p-4 rounded border border-purple-500/20 text-sm text-gray-300">
                      <span className="block text-purple-400 font-bold mb-1">🔮 Echo Perk Unlocked</span>
                      <strong>{result.echoReward.perk.name}</strong> — {result.echoReward.perk.description}
                    </div>
                  )}
                </div>
              )}
              
              <button className="btn border border-red-500/50 text-red-400 hover:bg-red-900/30 hover:border-red-400 !py-4 !px-12 !text-lg mx-auto" onClick={() => navigate(`/singleplayer/summary/${charId}`)} id="btn-summary">
                View Run Summary
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
