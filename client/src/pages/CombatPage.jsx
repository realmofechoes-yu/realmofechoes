import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import api from '../utils/api';
import { CLASS_INFO } from '../data/gameData';
import './CombatPage.css';

export default function CombatPage() {
  const { charId } = useParams();
  const navigate = useNavigate();
  const { combatState, setCombatState, currentCharacter, setCurrentCharacter, skills } = useGame();
  const [turnLog, setTurnLog] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [damageNumbers, setDamageNumbers] = useState([]);
  const [enemyShake, setEnemyShake] = useState(false);
  const [playerShake, setPlayerShake] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [showItems, setShowItems] = useState(false);
  const logRef = useRef(null);
  const dmgIdRef = useRef(0);

  useEffect(() => {
    if (!combatState) navigate(`/dungeon/${charId}`);
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

  const showDamage = (amount, type = 'damage', target = 'enemy') => {
    const id = ++dmgIdRef.current;
    const x = target === 'enemy' ? 60 + Math.random() * 20 : 20 + Math.random() * 20;
    setDamageNumbers(prev => [...prev, { id, amount, type, x }]);
    setTimeout(() => setDamageNumbers(prev => prev.filter(d => d.id !== id)), 1500);
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

      // Process visual effects
      for (const evt of data.turnLog) {
        if (evt.type === 'player_attack' || evt.type === 'player_skill') {
          setEnemyShake(true);
          showDamage(evt.amount, evt.isCrit ? 'crit' : 'damage', 'enemy');
          setTimeout(() => setEnemyShake(false), 500);
        }
        if (evt.type === 'enemy_damage' || evt.type === 'enemy_attack') {
          setPlayerShake(true);
          showDamage(evt.amount, 'damage', 'player');
          setTimeout(() => setPlayerShake(false), 500);
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

  if (!combatState) return null;

  const { player, enemy } = combatState;
  const classInfo = CLASS_INFO[player.class];
  const playerHpPct = (player.hp / player.maxHp) * 100;
  const playerSpPct = (player.sp / player.maxSp) * 100;
  const enemyHpPct = (enemy.hp / enemy.maxHp) * 100;

  return (
    <div className="combat-page animate-fade-in">
      <div className="combat-header">
        <h2 className="page-title">⚔️ Combat — Turn {combatState.turn}</h2>
        {enemy.isBoss && <span className="boss-badge">👹 BOSS</span>}
      </div>

      <div className="combat-arena">
        {/* Player Side */}
        <div className={`combatant player-side ${playerShake ? 'animate-shake' : ''}`}>
          <div className="combatant-icon">{classInfo?.icon}</div>
          <h3 className="combatant-name">{player.name}</h3>
          <span className="combatant-level">Lv.{player.level} {classInfo?.name}</span>
          <div className="combatant-bars">
            <div className="stat-bar stat-bar-hp"><div className="stat-bar-fill" style={{ width: `${playerHpPct}%` }}></div>
              <span className="stat-bar-label">HP {player.hp}/{player.maxHp}</span></div>
            <div className="stat-bar stat-bar-sp"><div className="stat-bar-fill" style={{ width: `${playerSpPct}%` }}></div>
              <span className="stat-bar-label">SP {player.sp}/{player.maxSp}</span></div>
          </div>
          {player.statusEffects?.length > 0 && (
            <div className="status-effects">
              {player.statusEffects.map((e, i) => (
                <span key={i} className="status-tag status-debuff">🔥 {e.name || e.type} ({e.duration}t)</span>
              ))}
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
            style={{ left: `${d.x}%` }}>
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
            disabled={actionLoading} id="btn-attack">
            ⚔️ Attack
          </button>
          {skills && Object.entries(skills).filter(([k]) => k.startsWith('skill')).map(([key, skill]) => (
            <button key={key} className="btn btn-arcane btn-lg action-btn" onClick={() => processAction('skill', key)}
              disabled={actionLoading || player.sp < skill.spCost} id={`btn-${key}`}
              title={`${skill.description} (${skill.spCost} SP)`}>
              {key === 'skill1' ? (classInfo?.skills[0]?.icon || '✨') : (classInfo?.skills[1]?.icon || '🌟')} {skill.name}
              <span className="skill-cost">{skill.spCost} SP</span>
            </button>
          ))}
          <button className="btn btn-frost btn-lg action-btn" onClick={() => processAction('defend')}
            disabled={actionLoading} id="btn-defend">
            🛡️ Defend
          </button>
          <button className="btn btn-nature btn-lg action-btn" onClick={() => setShowItems(!showItems)}
            disabled={actionLoading || inventory.length === 0} id="btn-items">
            🧪 Items ({inventory.length})
          </button>
          <button className="btn btn-ghost btn-lg action-btn" onClick={handleFlee}
            disabled={actionLoading} id="btn-flee">
            🏃 Flee
          </button>

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
                    <div key={i} className="result-loot-item">
                      <span className={`badge badge-${item.rarity}`}>{item.rarity}</span> {item.name}
                    </div>
                  ))}
                </div>
              )}
              {result.leveledUp && <p className="level-up-msg">🎊 Level Up! Check your stat points!</p>}
              <button className="btn btn-gold btn-lg btn-full mt-lg" onClick={() => navigate(`/dungeon/${charId}`)} id="btn-continue">
                Continue Exploring
              </button>
            </>
          ) : (
            <>
              <h3 className="text-danger">💀 Defeated</h3>
              <p>You have fallen to {enemy.name}...</p>
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
