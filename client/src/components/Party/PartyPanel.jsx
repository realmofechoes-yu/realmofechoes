import { CLASS_INFO } from '../../data/gameData';
import './PartyPanel.css';

export default function PartyPanel({ players, currentTurnUserId, myUserId }) {
  if (!players || players.length === 0) return null;

  return (
    <div className="party-panel">
      <h4 className="party-title">⚔️ Party</h4>
      {players.map(p => {
        const ci = CLASS_INFO[p.class];
        const hpPct = p.maxHp ? (p.hp / p.maxHp) * 100 : 0;
        const spPct = p.maxSp ? (p.sp / p.maxSp) * 100 : 0;
        const isTurn = p.userId === currentTurnUserId;
        const isMe = p.userId === myUserId;
        const isDead = !p.isAlive;

        return (
          <div key={p.userId} className={`party-member ${isTurn ? 'active-turn' : ''} ${isDead ? 'dead' : ''} ${isMe ? 'is-me' : ''}`}>
            <div className="pm-header">
              <span className="pm-icon">{isDead ? '💀' : ci?.icon || '👤'}</span>
              <span className="pm-name">{p.username}{isMe ? ' ★' : ''}</span>
              <span className="pm-level">Lv.{p.level}</span>
            </div>
            <div className="pm-bars">
              <div className="pm-bar pm-hp">
                <div className="pm-bar-fill" style={{ width: `${hpPct}%` }}></div>
                <span className="pm-bar-text">{p.hp}/{p.maxHp}</span>
              </div>
              <div className="pm-bar pm-sp">
                <div className="pm-bar-fill" style={{ width: `${spPct}%` }}></div>
                <span className="pm-bar-text">{p.sp}/{p.maxSp}</span>
              </div>
            </div>
            {p.statusEffects?.length > 0 && (
              <div className="pm-effects">
                {p.statusEffects.map((e, i) => (
                  <span key={i} className="pm-effect">🔥{e.name || e.type}</span>
                ))}
              </div>
            )}
            {isTurn && <div className="pm-turn-indicator">⚔️ Acting</div>}
            {p.isDefending && <div className="pm-status-badge">🛡️</div>}
          </div>
        );
      })}
    </div>
  );
}
