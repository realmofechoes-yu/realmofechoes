const { getOne, getAll, run } = require('../db/database');
const { calculateDamage, calculateEnemyDamage, getDefendReduction, resolveEnemyAction, checkLevelUp, CLASS_SKILLS } = require('../game/combat-engine');
const { generateCombatLoot } = require('../game/loot-generator');
const { generateEchoReward, ACHIEVEMENT_DEFINITIONS } = require('../game/echo-system');
const { getActiveLobbies } = require('./lobby-handlers');
const { getSession } = require('./game-handlers');

// Active co-op combat states
const coopCombatStates = new Map();

function registerCombatHandlers(io, socket) {

  // Start co-op combat
  socket.on('combat:start_coop', async (data, callback) => {
    try {
      const { sessionId, enemy } = data;
      const session = getSession(sessionId);
      if (!session) return callback({ success: false, error: 'No session.' });

      const lobby = getActiveLobbies().get(session.lobbyId);
      if (!lobby) return callback({ success: false, error: 'No lobby.' });

      // Build player states
      const players = [];
      for (const p of lobby.players) {
        if (!p.characterId) continue;
        const char = await getOne('SELECT * FROM characters WHERE id = $1', [p.characterId]);
        if (!char || !char.is_alive) continue;

        const weapon = await getOne("SELECT * FROM inventory WHERE character_id = $1 AND type = 'weapon' AND is_equipped = TRUE", [char.id]);
        let weaponPower = 0;
        if (weapon) {
          try { const s = JSON.parse(weapon.stats); weaponPower = Object.values(s).reduce((a, v) => a + (typeof v === 'number' ? v : 0), 0); } catch (e) {}
        }
        const armor = await getOne("SELECT * FROM inventory WHERE character_id = $1 AND type = 'armor' AND is_equipped = TRUE", [char.id]);
        let armorDef = 0;
        if (armor) {
          try { const s = JSON.parse(armor.stats); armorDef = s.vit || s.def || 0; } catch (e) {}
        }

        players.push({
          userId: p.userId, username: p.username, slotIndex: p.slotIndex,
          state: { ...char, weaponPower, totalDef: char.vit + armorDef, statusEffects: [], isDefending: false, isDodging: false },
          totalDamageDealt: 0, totalDamageReceived: 0, isAlive: true
        });
      }

      // Build turn queue: players by slot, then enemy
      const turnQueue = [];
      for (const p of players) turnQueue.push({ type: 'player', userId: p.userId, slotIndex: p.slotIndex });
      turnQueue.push({ type: 'enemy', index: 0 });

      const combatState = {
        sessionId, lobbyId: session.lobbyId,
        players, enemies: [{ ...enemy, statusEffects: [], buffedDef: 0 }],
        turnQueue, currentTurnIndex: 0, round: 1,
        log: [], turnTimer: null
      };

      coopCombatStates.set(sessionId, combatState);

      const sanitized = sanitizeCoopState(combatState);
      io.to(`lobby:${session.lobbyId}`).emit('combat:started', {
        combatState: sanitized,
        skills: players.reduce((acc, p) => { acc[p.userId] = CLASS_SKILLS[p.state.class]; return acc; }, {})
      });

      // Start first turn
      emitCurrentTurn(io, combatState);
      startTurnTimer(io, combatState);

      callback({ success: true });
    } catch (err) {
      console.error('Start coop combat error:', err);
      callback({ success: false, error: 'Failed to start combat.' });
    }
  });

  // Player submits combat action
  socket.on('combat:action', async (data, callback) => {
    try {
      const { sessionId, action, skillKey, itemId } = data;
      const combatState = coopCombatStates.get(sessionId);
      if (!combatState) return callback({ success: false, error: 'No combat.' });

      const currentTurn = combatState.turnQueue[combatState.currentTurnIndex];
      if (currentTurn.type !== 'player' || currentTurn.userId !== socket.user.id) {
        return callback({ success: false, error: 'Not your turn.' });
      }

      clearTurnTimer(combatState);

      const playerData = combatState.players.find(p => p.userId === socket.user.id);
      if (!playerData || !playerData.isAlive) return callback({ success: false, error: 'You cannot act.' });

      const player = playerData.state;
      const enemy = combatState.enemies[0];
      const turnLog = [];

      // Apply DoTs to this player
      let dotDmg = 0;
      player.statusEffects = player.statusEffects.filter(e => {
        if (e.type === 'dot') { dotDmg += e.damage; turnLog.push({ type: 'dot_damage', target: socket.user.username, amount: e.damage, name: e.name }); e.duration--; return e.duration > 0; }
        return true;
      });
      player.hp = Math.max(0, player.hp - dotDmg);

      // Check stun
      const stunIdx = player.statusEffects.findIndex(e => e.type === 'stun');
      if (stunIdx >= 0) {
        turnLog.push({ type: 'stunned', target: socket.user.username, message: `${socket.user.username} is stunned!` });
        player.statusEffects.splice(stunIdx, 1);
      } else {
        player.isDefending = false;
        player.isDodging = false;
        resolvePlayerAction(player, enemy, action, skillKey, itemId, turnLog, playerData, socket.user.username, playerData.state.id);
      }

      // Check enemy death
      if (enemy.hp <= 0) {
        return await handleCoopVictory(io, combatState, turnLog);
      }

      // Check if this player died from DoT
      if (player.hp <= 0) {
        playerData.isAlive = false;
        turnLog.push({ type: 'player_died', message: `${socket.user.username} has fallen!` });
      }

      // Check total party wipe
      if (combatState.players.every(p => !p.isAlive)) {
        return await handleCoopDefeat(io, combatState, turnLog);
      }

      combatState.log.push(...turnLog);

      // Broadcast this turn result
      io.to(`lobby:${combatState.lobbyId}`).emit('combat:turn_result', {
        actor: { type: 'player', userId: socket.user.id, username: socket.user.username },
        turnLog, combatState: sanitizeCoopState(combatState)
      });

      // Advance to next turn
      advanceTurn(io, combatState);
      callback({ success: true });
    } catch (err) {
      console.error('Combat action error:', err);
      callback({ success: false, error: 'Combat error.' });
    }
  });

  // Host dismisses the combat result
  socket.on('combat:dismiss_result', async (data, callback) => {
    try {
      const { sessionId, lobbyId } = data;
      // We don't have the combatState anymore because it was deleted on victory/defeat,
      // but we can just broadcast to the lobby to navigate.
      const lobby = getActiveLobbies().get(lobbyId);
      if (!lobby) return callback({ success: false, error: 'Lobby not found.' });
      if (lobby.hostUserId !== socket.user.id) return callback({ success: false, error: 'Only host can dismiss.' });

      io.to(`lobby:${lobbyId}`).emit('combat:result_dismissed', {});
      if (callback) callback({ success: true });
    } catch (err) {
      console.error('Dismiss combat result error:', err);
      if (callback) callback({ success: false, error: 'Server error.' });
    }
  });

  // Sync combat state (for reconnection)
  socket.on('combat:sync', (data, callback) => {
    const { sessionId } = data;
    const state = coopCombatStates.get(sessionId);
    if (!state) return callback({ success: false, error: 'No active combat for this session.' });
    
    // Re-join the lobby room just in case
    socket.join(`lobby:${state.lobbyId}`);
    
    callback({ success: true, combatState: sanitizeCoopState(state) });
  });
}

function resolvePlayerAction(player, enemy, action, skillKey, itemId, turnLog, playerData, username, charId) {
  switch (action) {
    case 'attack': {
      const result = calculateDamage(player, enemy);
      enemy.hp = Math.max(0, enemy.hp - result.damage);
      playerData.totalDamageDealt += result.damage;
      turnLog.push({ type: 'player_attack', username, amount: result.damage, isCrit: result.isCrit, message: result.isCrit ? `${username}: Critical hit! ${result.damage} damage!` : `${username} attacks for ${result.damage} damage.` });
      break;
    }
    case 'skill': {
      const skills = CLASS_SKILLS[player.class];
      const skill = skills?.[skillKey];
      if (!skill || player.sp < skill.spCost) { turnLog.push({ type: 'error', message: `${username}: Not enough SP!` }); break; }
      player.sp -= skill.spCost;
      if (skill.type === 'damage' || skill.type === 'damage_slow') {
        const result = calculateDamage(player, enemy, true, skill);
        enemy.hp = Math.max(0, enemy.hp - result.damage);
        playerData.totalDamageDealt += result.damage;
        turnLog.push({ type: 'player_skill', username, name: skill.name, amount: result.damage, isCrit: result.isCrit, message: `${username} uses ${skill.name} for ${result.damage} damage!` });
        if (skill.type === 'damage_slow' && skill.slowDuration) {
          enemy.statusEffects.push({ type: 'slow', duration: skill.slowDuration });
        }
      } else if (skill.type === 'stun') {
        const result = calculateDamage(player, enemy, true, skill);
        enemy.hp = Math.max(0, enemy.hp - result.damage);
        playerData.totalDamageDealt += result.damage;
        enemy.statusEffects.push({ type: 'stun', duration: skill.duration });
        turnLog.push({ type: 'player_skill', username, name: skill.name, amount: result.damage, message: `${username} uses ${skill.name}! Enemy stunned!` });
      } else if (skill.type === 'dodge') {
        player.isDodging = true;
        turnLog.push({ type: 'player_skill', username, name: skill.name, amount: 0, message: `${username} uses ${skill.name}! Will dodge!` });
      }
      break;
    }
    case 'defend': {
      player.isDefending = true;
      turnLog.push({ type: 'player_defend', username, message: `${username} defends! -50% damage.` });
      break;
    }
    case 'use_item': {
      // Item usage handled async elsewhere for now, simplified here
      turnLog.push({ type: 'use_item', username, message: `${username} uses an item.` });
      break;
    }
  }
}

function advanceTurn(io, combatState) {
  combatState.currentTurnIndex++;

  // Skip dead players
  while (combatState.currentTurnIndex < combatState.turnQueue.length) {
    const turn = combatState.turnQueue[combatState.currentTurnIndex];
    if (turn.type === 'player') {
      const pd = combatState.players.find(p => p.userId === turn.userId);
      if (!pd || !pd.isAlive) { combatState.currentTurnIndex++; continue; }
    }
    break;
  }

  // End of round?
  if (combatState.currentTurnIndex >= combatState.turnQueue.length) {
    combatState.round++;
    combatState.currentTurnIndex = 0;

    // Rebuild turn queue skipping dead
    combatState.turnQueue = [];
    for (const p of combatState.players) {
      if (p.isAlive) combatState.turnQueue.push({ type: 'player', userId: p.userId, slotIndex: p.slotIndex });
    }
    combatState.turnQueue.push({ type: 'enemy', index: 0 });
    combatState.currentTurnIndex = 0;

    io.to(`lobby:${combatState.lobbyId}`).emit('combat:round_end', { round: combatState.round, combatState: sanitizeCoopState(combatState) });
  }

  const currentTurn = combatState.turnQueue[combatState.currentTurnIndex];
  if (!currentTurn) return;

  if (currentTurn.type === 'enemy') {
    processEnemyTurn(io, combatState);
  } else {
    emitCurrentTurn(io, combatState);
    startTurnTimer(io, combatState);
  }
}

async function processEnemyTurn(io, combatState) {
  const enemy = combatState.enemies[0];
  const turnLog = [];

  // Check enemy stun
  const stunIdx = enemy.statusEffects.findIndex(e => e.type === 'stun');
  if (stunIdx >= 0) {
    turnLog.push({ type: 'stunned', target: 'enemy', message: `${enemy.name} is stunned!` });
    enemy.statusEffects.splice(stunIdx, 1);
  } else {
    // Pick target — weighted selection
    const aliveP = combatState.players.filter(p => p.isAlive);
    if (aliveP.length > 0) {
      const target = selectTarget(enemy, aliveP);
      const player = target.state;

      if (player.isDodging) {
        turnLog.push({ type: 'dodge', message: `${enemy.name} attacks ${target.username} but they dodge!` });
        player.isDodging = false;
      } else {
        const enemyResult = resolveEnemyAction(enemy, player);
        let dmg = enemyResult.totalDamage;
        if (player.isDefending) dmg = Math.floor(dmg * getDefendReduction());
        player.hp = Math.max(0, player.hp - dmg);
        target.totalDamageReceived += dmg;

        for (const evt of enemyResult.events) {
          if (evt.type === 'damage_player') {
            const actualDmg = player.isDefending ? Math.floor(evt.amount * getDefendReduction()) : evt.amount;
            turnLog.push({ type: 'enemy_damage', target: target.username, amount: actualDmg, message: `${enemy.name} deals ${actualDmg} to ${target.username}!` });
          } else if (evt.type === 'enemy_special') {
            turnLog.push({ type: 'enemy_special', name: evt.name, message: `${enemy.name} uses ${evt.name}!` });
          } else if (evt.type === 'apply_dot') {
            player.statusEffects.push({ type: 'dot', damage: evt.damage, duration: evt.duration, name: evt.name });
            turnLog.push({ type: 'debuff', target: target.username, name: evt.name, message: `${target.username} is afflicted with ${evt.name}!` });
          } else if (evt.type === 'stun_player') {
            player.statusEffects.push({ type: 'stun', duration: 1 });
            turnLog.push({ type: 'stun', target: target.username, message: `${target.username} is stunned!` });
          } else if (evt.type === 'drain_sp') {
            const drained = Math.min(evt.amount, player.sp);
            player.sp -= drained;
            turnLog.push({ type: 'drain', target: target.username, amount: drained, message: `${enemy.name} drains ${drained} SP from ${target.username}!` });
          } else if (evt.type === 'enemy_heal') {
            enemy.hp = Math.min(enemy.maxHp, enemy.hp + evt.amount);
            turnLog.push({ type: 'enemy_heal', amount: evt.amount, message: `${enemy.name} heals ${evt.amount} HP!` });
          }
        }

        if (player.hp <= 0) {
          target.isAlive = false;
          turnLog.push({ type: 'player_died', target: target.username, message: `${target.username} has fallen!` });
        }
      }
    }
  }

  combatState.log.push(...turnLog);

  // Check party wipe
  if (combatState.players.every(p => !p.isAlive)) {
    return await handleCoopDefeat(io, combatState, turnLog);
  }

  io.to(`lobby:${combatState.lobbyId}`).emit('combat:turn_result', {
    actor: { type: 'enemy', name: enemy.name },
    turnLog, combatState: sanitizeCoopState(combatState)
  });

  // Sync HP/SP to DB
  for (const p of combatState.players) {
    await run('UPDATE characters SET hp = $1, sp = $2, updated_at = NOW() WHERE id = $3', [p.state.hp, p.state.sp, p.state.id]);
  }

  advanceTurn(io, combatState);
}

function selectTarget(enemy, alivePlayers) {
  const roll = Math.random();
  if (roll < 0.4) {
    return alivePlayers.reduce((min, p) => p.state.hp < min.state.hp ? p : min);
  } else if (roll < 0.7) {
    return alivePlayers.reduce((max, p) => p.totalDamageDealt > max.totalDamageDealt ? p : max);
  }
  return alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
}

async function handleCoopVictory(io, combatState, turnLog) {
  const enemy = combatState.enemies[0];
  const xp = enemy.xpReward || 20;
  const gold = enemy.goldReward || 10;
  const goldEach = Math.floor(gold / combatState.players.length);

  turnLog.push({ type: 'victory', message: `${enemy.name} defeated!` });
  turnLog.push({ type: 'reward', xp, gold, message: `+${xp} XP, +${goldEach} gold each!` });

  for (const p of combatState.players) {
    const char = await getOne('SELECT * FROM characters WHERE id = $1', [p.state.id]);
    let newXp = char.xp + xp;
    let newLevel = char.level;
    let newStatPts = char.stat_points;
    const lu = checkLevelUp(newXp, newLevel);
    if (lu.leveledUp) { newXp = lu.remainingXp; newLevel++; newStatPts += lu.statPoints; }
    await run('UPDATE characters SET xp=$1, level=$2, stat_points=$3, gold=gold+$4, hp=$5, sp=$6, current_room = current_room + 1, rooms_cleared = rooms_cleared + 1, enemies_defeated=enemies_defeated+1, damage_dealt_total=damage_dealt_total+$7, damage_received_total=damage_received_total+$8, updated_at=NOW() WHERE id=$9',
      [newXp, newLevel, newStatPts, goldEach, p.state.hp, p.state.sp, p.totalDamageDealt, p.totalDamageReceived, p.state.id]);
  }

  // Also update the session room
  await run('UPDATE coop_sessions SET current_room = current_room + 1, updated_at = NOW() WHERE id = $1', [combatState.sessionId]);
  const session = getSession(combatState.sessionId);
  if (session) session.currentRoom += 1;

  const loot = generateCombatLoot(combatState.players[0]?.state.current_floor || 1, enemy.id);
  for (let i = 0; i < loot.length; i++) {
    const recipient = combatState.players[Math.floor(Math.random() * combatState.players.length)];
    await run('INSERT INTO inventory (character_id,item_id,name,type,rarity,stats,description,is_equipped,quantity) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [recipient.state.id, loot[i].item_id, loot[i].name, loot[i].type, loot[i].rarity, loot[i].stats, loot[i].description, false, loot[i].quantity]);
    turnLog.push({ type: 'loot', item: loot[i], recipient: recipient.username, message: `${recipient.username} found: ${loot[i].name} (${loot[i].rarity})` });
  }

  combatState.log.push(...turnLog);
  clearTurnTimer(combatState);
  coopCombatStates.delete(combatState.sessionId);

  io.to(`lobby:${combatState.lobbyId}`).emit('combat:victory', {
    turnLog, loot, combatState: sanitizeCoopState(combatState)
  });
}

async function handleCoopDefeat(io, combatState, turnLog) {
  turnLog.push({ type: 'defeat', message: 'The party has fallen...' });

  for (const p of combatState.players) {
    await run('UPDATE characters SET is_alive = FALSE, run_status = $1, hp = 0, updated_at = NOW() WHERE id = $2', ['dead', p.state.id]);
    await run('UPDATE users SET total_runs = total_runs + 1, deepest_floor = GREATEST(deepest_floor, $1) WHERE id = $2', [p.state.current_floor, p.userId]);
  }

  const echoReward = generateEchoReward({
    lastEnemy: combatState.enemies[0].name.toLowerCase(),
    floorsCleared: combatState.players[0]?.state.current_floor || 1,
    totalGold: 0, totalKills: 0, totalRuns: 0
  });

  combatState.log.push(...turnLog);
  clearTurnTimer(combatState);
  coopCombatStates.delete(combatState.sessionId);

  io.to(`lobby:${combatState.lobbyId}`).emit('combat:defeat', {
    turnLog, echoReward, combatState: sanitizeCoopState(combatState)
  });
}

function emitCurrentTurn(io, combatState) {
  const turn = combatState.turnQueue[combatState.currentTurnIndex];
  if (!turn || turn.type !== 'player') return;

  io.to(`lobby:${combatState.lobbyId}`).emit('combat:current_turn', {
    userId: turn.userId,
    round: combatState.round,
    timeLimit: 30
  });
}

function startTurnTimer(io, combatState) {
  clearTurnTimer(combatState);
  combatState.turnTimer = setTimeout(() => {
    // Auto-defend on timeout
    const turn = combatState.turnQueue[combatState.currentTurnIndex];
    if (!turn || turn.type !== 'player') return;
    const pd = combatState.players.find(p => p.userId === turn.userId);
    if (!pd || !pd.isAlive) { advanceTurn(io, combatState); return; }

    pd.state.isDefending = true;
    const turnLog = [{ type: 'timeout', username: pd.username, message: `${pd.username} took too long — auto-defending!` }];
    combatState.log.push(...turnLog);

    io.to(`lobby:${combatState.lobbyId}`).emit('combat:turn_result', {
      actor: { type: 'player', userId: turn.userId, username: pd.username },
      turnLog, combatState: sanitizeCoopState(combatState)
    });

    advanceTurn(io, combatState);
  }, 30000);
}

function clearTurnTimer(combatState) {
  if (combatState.turnTimer) { clearTimeout(combatState.turnTimer); combatState.turnTimer = null; }
}

function sanitizeCoopState(state) {
  return {
    round: state.round,
    currentTurnIndex: state.currentTurnIndex,
    turnQueue: state.turnQueue,
    players: state.players.map(p => ({
      userId: p.userId, username: p.username, slotIndex: p.slotIndex, isAlive: p.isAlive,
      hp: p.state.hp, maxHp: p.state.max_hp, sp: p.state.sp, maxSp: p.state.max_sp,
      name: p.state.name, class: p.state.class, level: p.state.level,
      str: p.state.str, intel: p.state.intel, dex: p.state.dex, vit: p.state.vit,
      statusEffects: p.state.statusEffects, isDefending: p.state.isDefending, isDodging: p.state.isDodging
    })),
    enemies: state.enemies.map(e => ({
      name: e.name, hp: e.hp, maxHp: e.maxHp, flavorText: e.flavorText,
      special: e.special, statusEffects: e.statusEffects, isBoss: e.isBoss || false,
      sprite: e.sprite, sprites: e.sprites
    }))
  };
}

module.exports = { registerCombatHandlers, coopCombatStates };
