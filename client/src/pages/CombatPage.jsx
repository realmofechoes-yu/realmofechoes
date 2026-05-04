import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useAuth } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import { useSocketEvent, useSocketEmit } from '../hooks/useSocket';
import api from '../utils/api';
import { CLASS_INFO } from '../data/gameData';
import TurnIndicator from '../components/Combat/TurnIndicator';
import './CombatPage.css';

export default function CombatPage() {
  const { charId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const { 
    combatState, setCombatState, 
    currentCharacter, setCurrentCharacter, 
    skills,
    coopSessionId, setCoopSessionId,
    coopCombatState, setCoopCombatState
  } = useGame();

  const { socket, connected } = useSocketContext();
  const { emit } = useSocketEmit();

  const [turnLog, setTurnLog] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [damageNumbers, setDamageNumbers] = useState([]);
  const [enemyShake, setEnemyShake] = useState(false);
  const [playerShakes, setPlayerShakes] = useState({});
  const [inventory, setInventory] = useState([]);
  const [showItems, setShowItems] = useState(false);
  const [currentTurnUserId, setCurrentTurnUserId] = useState(null);
  const logRef = useRef(null);
  const dmgIdRef = useRef(0);

  const queryParams = new URLSearchParams(location.search);
  const isCoop = !!coopSessionId || !!queryParams.get('coop');

  useEffect(() => {
    if (queryParams.get('coop')) {
      setCoopSessionId(queryParams.get('coop'));
    }
  }, [location.search]);

  useEffect(() => {
    if (!isCoop && !combatState) navigate(`/dungeon/${charId}`);
    if (isCoop && !coopCombatState) navigate(`/dungeon/${charId}?coop=${coopSessionId || queryParams.get('coop')}`);
    loadConsumables();
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [allLogs]);

  const loadConsumables = async () => {
    try {
      const data = await api.getInventory(parseInt(charId), { type: 'consumable' });
      setInventory(data.items || []);
    } catch (e) { /* ignore */ }
  };

  const showDamage = (amount, type = 'damage', target = 'enemy', targetId = null) => {
    const id = ++dmgIdRef.current;
    let x;
    if (target === 'enemy') {
      x = 60 + Math.random() * 20;
    } else {
      // For players, we distribute them horizontally if co-op
      x = 20 + Math.random() * 20; 
    }
    setDamageNumbers(prev => [...prev, { id, amount, type, x, targetId }]);
    setTimeout(() => setDamageNumbers(prev => prev.filter(d => d.id !== id)), 1500);
  };

  const shakePlayer = (userId) => {
    setPlayerShakes(prev => ({ ...prev, [userId]: true }));
    setTimeout(() => setPlayerShakes(prev => ({ ...prev, [userId]: false })), 500);
  };

  // --- CO-OP SOCKET LOGIC ---

  useSocketEvent('combat:turn_result', (data) => {
    setCoopCombatState(data.combatState);
    setTurnLog(data.turnLog);
    setAllLogs(prev => [...prev, ...data.turnLog]);

    // Process visual effects
    for (const evt of data.turnLog) {
      if (evt.type === 'player_attack' || evt.type === 'player_skill') {
        setEnemyShake(true);
        showDamage(evt.amount, evt.isCrit ? 'crit' : 'damage', 'enemy');
        setTimeout(() => setEnemyShake(false), 500);
      }
      if (evt.type === 'enemy_damage' || evt.type === 'enemy_attack') {
        // Find who was hit (by username)
        const targetPlayer = data.combatState.players.find(p => p.username === evt.target);
        if (targetPlayer) {
          shakePlayer(targetPlayer.userId);
          showDamage(evt.amount, 'damage', 'player', targetPlayer.userId);
        } else if (!isCoop) {
          shakePlayer('me');
          showDamage(evt.amount, 'damage', 'player', 'me');
        }
      }
      if (evt.type === 'use_item' || evt.type === 'enemy_heal') {
        showDamage(evt.amount || '✓', 'heal', evt.type === 'enemy_heal' ? 'enemy' : 'player');
      }
    }
  });

  useSocketEvent('combat:current_turn', (data) => {
    setCurrentTurnUserId(data.userId);
    setActionLoading(false);
  });

  useSocketEvent('combat:round_end', (data) => {
    setCoopCombatState(data.combatState);
  });

  useSocketEvent('combat:victory', (data) => {
    setCoopCombatState(data.combatState);
    setAllLogs(prev => [...prev, ...data.turnLog]);
    setResult({ victory: true, loot: data.loot });
  });

  useSocketEvent('combat:defeat', (data) => {
    setCoopCombatState(data.combatState);
    setAllLogs(prev => [...prev, ...data.turnLog]);
    setResult({ victory: false, echoReward: data.echoReward });
  });

  // --- UNIFIED ACTION PROCESSING ---

  const processAction = async (action, skillKey = null, itemId = null) => {
    if (actionLoading || result) return;
    setActionLoading(true);
    setShowItems(false);

    if (isCoop) {
      try {
        const sessionId = coopSessionId || queryParams.get('coop');
        await emit('combat:action', { sessionId, action, skillKey, itemId });
        // The result will come back via 'combat:turn_result'
      } catch (err) {
        console.error(err);
        setAllLogs(prev => [...prev, { type: 'error', message: err.message }]);
        setActionLoading(false);
      }
    } else {
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
            shakePlayer('me');
            showDamage(evt.amount, 'damage', 'player', 'me');
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
    }
  };

  const handleFlee = async () => {
    if (actionLoading || result || isCoop) return; // Fleeing not allowed in co-op yet
    setActionLoading(true);
    try {
      const data = await api.flee(parseInt(charId));
      if (data.fled) {
        setAllLogs(prev => [...prev, { type: 'flee', message: 'You escaped!' }]);
        setTimeout(() => navigate(`/dungeon/${charId}`), 1500);
      } else {
        setCombatState(data.combatState);
        setTurnLog(data.turnLog);
        setAllLogs(prev => [...prev, ...data.turnLog]);
        if (data.death) setResult(data);
      }
    } catch (err) { console.error(err); }
    finally { setActionLoading(false); }
  };

  if (isCoop && !coopCombatState) return <div className="loader-container"><div className="loader"></div></div>;
  if (!isCoop && !combatState) return <div className="loader-container"><div className="loader"></div></div>;

  const state = isCoop ? coopCombatState : combatState;
  const enemy = state.enemies ? state.enemies[0] : state.enemy;
  const enemyHpPct = (enemy.hp / enemy.maxHp) * 100;
  
  // Single player state
  const myPlayerState = isCoop 
    ? state.players.find(p => p.userId === user.id) 
    : { ...state.player, isAlive: state.player.hp > 0, userId: user.id };

  let activeTurnUserId = currentTurnUserId;
  if (isCoop && state && !currentTurnUserId) {
    const turn = state.turnQueue[state.currentTurnIndex];
    if (turn?.type === 'player') activeTurnUserId = turn.userId;
  }

  const isMyTurn = isCoop ? activeTurnUserId === user.id : true;
  const activeUsername = isCoop ? state.players.find(p => p.userId === activeTurnUserId)?.username : myPlayerState?.name;

  return (
    <div className="combat-page animate-fade-in">
      <div className="combat-header">
        <h2 className="page-title">⚔️ Combat — Round {state.round || state.turn}</h2>
        {enemy.isBoss && <span className="boss-badge">👹 BOSS</span>}
      </div>

      {isCoop && activeTurnUserId && !result && (
        <div className="mb-md">
          <TurnIndicator isMyTurn={isMyTurn} activeUsername={activeUsername} timeLimit={30} />
        </div>
      )}

      <div className="combat-arena">
        {/* Player Side */}
        <div className="coop-players-side">
          {isCoop ? (
            state.players.map((p, index) => {
              const ci = CLASS_INFO[p.class];
              const hpPct = (p.hp / p.maxHp) * 100;
              const spPct = (p.sp / p.maxSp) * 100;
              const isTurn = p.userId === activeTurnUserId;
              const isDead = !p.isAlive;
              const shake = playerShakes[p.userId];

              return (
                <div key={p.userId} className={`combatant player-side ${shake ? 'animate-shake' : ''} ${isTurn ? 'active-turn' : ''} ${isDead ? 'dead' : ''}`}>
                  <div className="combatant-icon">{isDead ? '💀' : ci?.icon}</div>
                  <h3 className="combatant-name">{p.username}</h3>
                  <div className="combatant-bars">
                    <div className="stat-bar stat-bar-hp"><div className="stat-bar-fill" style={{ width: `${hpPct}%` }}></div></div>
                    <div className="stat-bar stat-bar-sp"><div className="stat-bar-fill" style={{ width: `${spPct}%` }}></div></div>
                  </div>
                  {p.isDefending && <div className="status-tag">🛡️ Defending</div>}
                </div>
              );
            })
          ) : (
            <div className={`combatant player-side ${playerShakes['me'] ? 'animate-shake' : ''}`}>
              <div className="combatant-icon">{CLASS_INFO[myPlayerState.class]?.icon}</div>
              <h3 className="combatant-name">{myPlayerState.name}</h3>
              <span className="combatant-level">Lv.{myPlayerState.level} {CLASS_INFO[myPlayerState.class]?.name}</span>
              <div className="combatant-bars">
                <div className="stat-bar stat-bar-hp"><div className="stat-bar-fill" style={{ width: `${(myPlayerState.hp / myPlayerState.maxHp) * 100}%` }}></div>
                  <span className="stat-bar-label">HP {myPlayerState.hp}/{myPlayerState.maxHp}</span></div>
                <div className="stat-bar stat-bar-sp"><div className="stat-bar-fill" style={{ width: `${(myPlayerState.sp / myPlayerState.maxSp) * 100}%` }}></div>
                  <span className="stat-bar-label">SP {myPlayerState.sp}/{myPlayerState.maxSp}</span></div>
              </div>
              {myPlayerState.statusEffects?.length > 0 && (
                <div className="status-effects">
                  {myPlayerState.statusEffects.map((e, i) => (
                    <span key={i} className="status-tag status-debuff">🔥 {e.name || e.type} ({e.duration}t)</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="combat-vs">VS</div>

        {/* Enemy Side */}
        <div className={`combatant enemy-side ${enemyShake ? 'animate-shake' : ''}`}>
          <div className="combatant-icon enemy-icon">{enemy.isBoss ? '👹' : '💀'}</div>
          <h3 className="combatant-name">{enemy.name}</h3>
          <p className="enemy-flavor">{enemy.flavorText}</p>
          <div className="combatant-bars">
            <div className="stat-bar stat-bar-hp"><div className="stat-bar-fill" style={{ width: `${enemyHpPct}%` }}></div>
              <span className="stat-bar-label">HP {enemy.hp}/{enemy.maxHp}</span></div>
          </div>
          {enemy.statusEffects?.length > 0 && (
            <div className="status-effects">
              {enemy.statusEffects.map((e, i) => (
                <span key={i} className="status-tag status-debuff">⚡ {e.type} ({e.duration}t)</span>
              ))}
            </div>
          )}
          {enemy.special && (
            <div className="enemy-special">
              <span className="special-name">⚡ {enemy.special.name}</span>
              <span className="special-desc">{enemy.special.description}</span>
            </div>
          )}
        </div>

        {/* Floating damage numbers */}
        {damageNumbers.map(d => (
          <div key={d.id} className={`damage-number dmg-${d.type}`}
            style={{ left: `${d.x}%`, top: d.targetId ? '40%' : '50%' }}>
            {d.type === 'heal' ? `+${d.amount}` : `-${d.amount}`}
          </div>
        ))}
      </div>

      {/* Combat Log */}
      <div className="combat-log panel" ref={logRef}>
        <h4 className="log-title">📜 Combat Log</h4>
        <div className="log-entries">
          {allLogs.slice(-12).map((entry, i) => (
            <div key={i} className={`log-entry log-${entry.type}`}>
              {entry.message}
            </div>
          ))}
        </div>
      </div>

      {/* Action Bar */}
      {!result ? (
        <div className="action-bar">
          <button className="btn btn-ember btn-lg action-btn" onClick={() => processAction('attack')}
            disabled={actionLoading || (isCoop && !isMyTurn) || !myPlayerState?.isAlive} id="btn-attack">
            ⚔️ Attack
          </button>
          
          {/* Skills */}
          {skills && Object.entries(skills).filter(([k]) => k.startsWith('skill')).map(([key, skill]) => (
            <button key={key} className="btn btn-arcane btn-lg action-btn" onClick={() => processAction('skill', key)}
              disabled={actionLoading || (isCoop && !isMyTurn) || !myPlayerState?.isAlive || myPlayerState?.sp < skill.spCost} id={`btn-${key}`}
              title={`${skill.description} (${skill.spCost} SP)`}>
              {key === 'skill1' ? (CLASS_INFO[myPlayerState?.class]?.skills[0]?.icon || '✨') : (CLASS_INFO[myPlayerState?.class]?.skills[1]?.icon || '🌟')} {skill.name}
              <span className="skill-cost">{skill.spCost} SP</span>
            </button>
          ))}
          
          <button className="btn btn-frost btn-lg action-btn" onClick={() => processAction('defend')}
            disabled={actionLoading || (isCoop && !isMyTurn) || !myPlayerState?.isAlive} id="btn-defend">
            🛡️ Defend
          </button>
          
          <button className="btn btn-nature btn-lg action-btn" onClick={() => setShowItems(!showItems)}
            disabled={actionLoading || (isCoop && !isMyTurn) || !myPlayerState?.isAlive || inventory.length === 0} id="btn-items">
            🧪 Items ({inventory.length})
          </button>
          
          {!isCoop && (
            <button className="btn btn-ghost btn-lg action-btn" onClick={handleFlee}
              disabled={actionLoading} id="btn-flee">
              🏃 Flee
            </button>
          )}

          {showItems && (
            <div className="items-dropdown panel">
              {inventory.map(item => (
                <button key={item.id} className="item-option" onClick={() => processAction('use_item', null, item.id)}>
                  <span>{item.name}</span>
                  <span className="item-qty">×{item.quantity}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="combat-result panel">
          {result.victory ? (
            <>
              <h3 className="text-gold">🎉 Victory!</h3>
              <p>{enemy.name} has been defeated!</p>
              {result.loot?.length > 0 && (
                <div className="result-loot">
                  <h4>Loot Drops:</h4>
                  {result.loot.map((item, i) => (
                    <div className="result-loot-item" key={i}>
                      <span className={`badge badge-${item.rarity}`}>{item.rarity}</span> {item.name}
                    </div>
                  ))}
                </div>
              )}
              {result.leveledUp && !isCoop && <p className="level-up-msg">🎊 Level Up! Check your stat points!</p>}
              <button className="btn btn-gold btn-lg btn-full mt-lg" onClick={() => navigate(`/dungeon/${charId}?coop=${coopSessionId || ''}`)} id="btn-continue">
                Return to Dungeon
              </button>
            </>
          ) : (
            <>
              <h3 className="text-danger">💀 Defeated</h3>
              <p>The party has fallen to {enemy.name}...</p>
              {result.echoReward && (
                <div className="echo-reward">
                  <p className="echo-lore">"{result.echoReward.lore?.text}"</p>
                  {result.echoReward.perk && (
                    <p className="echo-perk">🔮 Echo Perk Unlocked: <strong>{result.echoReward.perk.name}</strong> — {result.echoReward.perk.description}</p>
                  )}
                </div>
              )}
              <button className="btn btn-gold btn-lg btn-full mt-lg" onClick={() => navigate(`/summary/${charId}`)} id="btn-summary">
                View Run Summary
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
