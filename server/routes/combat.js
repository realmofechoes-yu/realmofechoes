const express = require('express');
const { getDb } = require('../db/database');
const authMiddleware = require('../middleware/auth');
const { calculateDamage, calculateEnemyDamage, getDefendReduction, resolveEnemyAction, checkLevelUp, CLASS_SKILLS } = require('../game/combat-engine');
const { generateCombatLoot } = require('../game/loot-generator');
const { checkAchievements, generateEchoReward } = require('../game/echo-system');

const router = express.Router();

// In-memory combat states (keyed by character id)
const combatStates = {};

// POST /api/combat/start - Initiate combat
router.post('/start', authMiddleware, (req, res) => {
  try {
    const { characterId, enemy } = req.body;
    const db = getDb();
    const char = db.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(characterId, req.user.id);
    if (!char) return res.status(404).json({ error: 'Character not found.' });

    // Get equipped weapon for weapon power
    const weapon = db.prepare("SELECT * FROM inventory WHERE character_id = ? AND type = 'weapon' AND is_equipped = 1").get(char.id);
    let weaponPower = 0;
    if (weapon) {
      try {
        const stats = JSON.parse(weapon.stats);
        weaponPower = Object.values(stats).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
      } catch (e) { /* ignore */ }
    }

    // Get total defense from armor
    const armor = db.prepare("SELECT * FROM inventory WHERE character_id = ? AND type = 'armor' AND is_equipped = 1").get(char.id);
    let armorDef = 0;
    if (armor) {
      try {
        const stats = JSON.parse(armor.stats);
        armorDef = stats.vit || stats.def || 0;
      } catch (e) { /* ignore */ }
    }

    const combatState = {
      characterId: char.id,
      player: {
        ...char,
        weaponPower,
        totalDef: char.vit + armorDef,
        statusEffects: [],
        isDefending: false,
        isDodging: false
      },
      enemy: { ...enemy, statusEffects: [], buffedDef: 0 },
      turn: 1,
      log: [],
      totalDamageDealt: 0,
      totalDamageReceived: 0
    };

    combatStates[char.id] = combatState;
    res.json({ combatState: sanitizeCombatState(combatState), skills: CLASS_SKILLS[char.class] });
  } catch (err) {
    console.error('Combat start error:', err);
    res.status(500).json({ error: 'Server error starting combat.' });
  }
});

// POST /api/combat/action - Submit player action
router.post('/action', authMiddleware, (req, res) => {
  try {
    const { characterId, action, skillKey, itemId } = req.body;
    const db = getDb();
    const state = combatStates[characterId];
    if (!state) return res.status(400).json({ error: 'No active combat.' });

    const player = state.player;
    const enemy = state.enemy;
    const turnLog = [];

    // Apply player DoTs
    let playerDotDmg = 0;
    player.statusEffects = player.statusEffects.filter(e => {
      if (e.type === 'dot') {
        playerDotDmg += e.damage;
        turnLog.push({ type: 'dot_damage', target: 'player', amount: e.damage, name: e.name });
        e.duration--;
        return e.duration > 0;
      }
      return true;
    });
    player.hp = Math.max(0, player.hp - playerDotDmg);

    // Check stun
    const stunIndex = player.statusEffects.findIndex(e => e.type === 'stun');
    if (stunIndex >= 0) {
      turnLog.push({ type: 'stunned', target: 'player', message: 'You are stunned and cannot act!' });
      player.statusEffects.splice(stunIndex, 1);
    } else {
      // Reset defend/dodge
      player.isDefending = false;
      player.isDodging = false;

      switch (action) {
        case 'attack': {
          const result = calculateDamage(player, enemy);
          enemy.hp = Math.max(0, enemy.hp - result.damage);
          state.totalDamageDealt += result.damage;
          turnLog.push({ type: 'player_attack', amount: result.damage, isCrit: result.isCrit, message: result.isCrit ? `Critical hit! Dealt ${result.damage} damage!` : `Attacked for ${result.damage} damage.` });
          break;
        }
        case 'skill': {
          const skills = CLASS_SKILLS[player.class];
          const skill = skills[skillKey];
          if (!skill) return res.status(400).json({ error: 'Invalid skill.' });
          if (player.sp < skill.spCost) return res.status(400).json({ error: 'Not enough SP.' });

          player.sp -= skill.spCost;
          if (skill.type === 'damage' || skill.type === 'damage_slow') {
            const result = calculateDamage(player, enemy, true, skill);
            enemy.hp = Math.max(0, enemy.hp - result.damage);
            state.totalDamageDealt += result.damage;
            turnLog.push({ type: 'player_skill', name: skill.name, amount: result.damage, isCrit: result.isCrit, spCost: skill.spCost, message: `Used ${skill.name} for ${result.damage} damage! (-${skill.spCost} SP)` });
            if (skill.type === 'damage_slow' && skill.slowDuration) {
              enemy.statusEffects.push({ type: 'slow', duration: skill.slowDuration });
              turnLog.push({ type: 'debuff', target: 'enemy', name: 'Slowed', message: `${enemy.name} is slowed!` });
            }
          } else if (skill.type === 'stun') {
            const result = calculateDamage(player, enemy, true, skill);
            enemy.hp = Math.max(0, enemy.hp - result.damage);
            state.totalDamageDealt += result.damage;
            enemy.statusEffects.push({ type: 'stun', duration: skill.duration });
            turnLog.push({ type: 'player_skill', name: skill.name, amount: result.damage, message: `Used ${skill.name}! ${enemy.name} is stunned! (-${skill.spCost} SP)` });
          } else if (skill.type === 'dodge') {
            player.isDodging = true;
            turnLog.push({ type: 'player_skill', name: skill.name, amount: 0, message: `Used ${skill.name}! Will dodge the next attack. (-${skill.spCost} SP)` });
          }
          break;
        }
        case 'defend': {
          player.isDefending = true;
          turnLog.push({ type: 'player_defend', message: 'Bracing for impact! Damage reduced by 50%.' });
          break;
        }
        case 'use_item': {
          if (!itemId) return res.status(400).json({ error: 'No item specified.' });
          const item = db.prepare('SELECT * FROM inventory WHERE id = ? AND character_id = ?').get(itemId, characterId);
          if (!item || item.type !== 'consumable') return res.status(400).json({ error: 'Invalid consumable.' });

          let effect;
          try { effect = JSON.parse(item.stats); } catch (e) { return res.status(400).json({ error: 'Invalid item data.' }); }

          if (effect.type === 'heal_hp') {
            const healed = Math.min(effect.amount, player.max_hp - player.hp);
            player.hp += healed;
            turnLog.push({ type: 'use_item', name: item.name, message: `Used ${item.name}! Restored ${healed} HP.` });
          } else if (effect.type === 'heal_sp') {
            const restored = Math.min(effect.amount, player.max_sp - player.sp);
            player.sp += restored;
            turnLog.push({ type: 'use_item', name: item.name, message: `Used ${item.name}! Restored ${restored} SP.` });
          } else if (effect.type === 'cure_dot') {
            player.statusEffects = player.statusEffects.filter(e => e.type !== 'dot');
            turnLog.push({ type: 'use_item', name: item.name, message: `Used ${item.name}! Cured all status effects.` });
          }

          if (item.quantity > 1) {
            db.prepare('UPDATE inventory SET quantity = quantity - 1 WHERE id = ?').run(item.id);
          } else {
            db.prepare('DELETE FROM inventory WHERE id = ?').run(item.id);
          }
          break;
        }
      }
    }

    // Check if enemy dead
    if (enemy.hp <= 0) {
      return handleVictory(req, res, state, turnLog, db);
    }

    // Enemy turn - check stun
    const enemyStunned = enemy.statusEffects.findIndex(e => e.type === 'stun');
    if (enemyStunned >= 0) {
      turnLog.push({ type: 'stunned', target: 'enemy', message: `${enemy.name} is stunned and cannot act!` });
      enemy.statusEffects.splice(enemyStunned, 1);
    } else {
      // Enemy action
      if (player.isDodging) {
        turnLog.push({ type: 'dodge', message: `${enemy.name} attacks but you dodge!` });
      } else {
        const enemyResult = resolveEnemyAction(enemy, player);
        let damageToPlayer = enemyResult.totalDamage;

        if (player.isDefending) {
          damageToPlayer = Math.floor(damageToPlayer * getDefendReduction());
        }

        // Apply damage
        player.hp = Math.max(0, player.hp - damageToPlayer);
        state.totalDamageReceived += damageToPlayer;

        for (const evt of enemyResult.events) {
          if (evt.type === 'damage_player') {
            const actualDmg = player.isDefending ? Math.floor(evt.amount * getDefendReduction()) : evt.amount;
            turnLog.push({ type: 'enemy_damage', amount: actualDmg, message: `${enemy.name} deals ${actualDmg} damage!` });
          } else if (evt.type === 'enemy_special') {
            turnLog.push({ type: 'enemy_special', name: evt.name, message: `${enemy.name} uses ${evt.name}!` });
          } else if (evt.type === 'apply_dot') {
            player.statusEffects.push({ type: 'dot', damage: evt.damage, duration: evt.duration, name: evt.name });
            turnLog.push({ type: 'debuff', target: 'player', name: evt.name, message: `You are afflicted with ${evt.name}!` });
          } else if (evt.type === 'stun_player') {
            player.statusEffects.push({ type: 'stun', duration: 1 });
            turnLog.push({ type: 'stun', target: 'player', message: 'You are frozen solid!' });
          } else if (evt.type === 'drain_sp') {
            const drained = Math.min(evt.amount, player.sp);
            player.sp -= drained;
            turnLog.push({ type: 'drain', target: 'player', amount: drained, message: `${enemy.name} drains ${drained} SP!` });
          } else if (evt.type === 'enemy_heal') {
            enemy.hp = Math.min(enemy.maxHp, enemy.hp + evt.amount);
            turnLog.push({ type: 'enemy_heal', amount: evt.amount, message: `${enemy.name} heals for ${evt.amount} HP!` });
          }
        }
      }
    }

    // Check player death
    if (player.hp <= 0) {
      return handleDeath(req, res, state, turnLog, db);
    }

    state.turn++;
    state.log.push(...turnLog);

    // Sync player HP/SP to database
    db.prepare('UPDATE characters SET hp = ?, sp = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(player.hp, player.sp, characterId);

    res.json({ combatState: sanitizeCombatState(state), turnLog, ongoing: true });
  } catch (err) {
    console.error('Combat action error:', err);
    res.status(500).json({ error: 'Server error processing combat action.' });
  }
});

function handleVictory(req, res, state, turnLog, db) {
  const { player, enemy, characterId } = state;
  const xpGained = enemy.xpReward || 20;
  const goldGained = enemy.goldReward || 10;

  turnLog.push({ type: 'victory', message: `${enemy.name} has been defeated!` });
  turnLog.push({ type: 'reward', xp: xpGained, gold: goldGained, message: `Gained ${xpGained} XP and ${goldGained} gold!` });

  // Update character
  const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
  let newXp = char.xp + xpGained;
  let newLevel = char.level;
  let newStatPoints = char.stat_points;

  const levelUpResult = checkLevelUp(newXp, newLevel);
  if (levelUpResult.leveledUp) {
    newXp = levelUpResult.remainingXp;
    newLevel++;
    newStatPoints += levelUpResult.statPoints;
    // Heal on level up
    player.hp = Math.min(player.hp + 20, player.max_hp);
    player.sp = Math.min(player.sp + 15, player.max_sp);
    turnLog.push({ type: 'level_up', level: newLevel, statPoints: levelUpResult.statPoints, message: `Level up! Now level ${newLevel}! +${levelUpResult.statPoints} stat points!` });
  }

  db.prepare('UPDATE characters SET xp = ?, level = ?, stat_points = ?, gold = gold + ?, hp = ?, sp = ?, enemies_defeated = enemies_defeated + 1, damage_dealt_total = damage_dealt_total + ?, damage_received_total = damage_received_total + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(newXp, newLevel, newStatPoints, goldGained, player.hp, player.sp, state.totalDamageDealt, state.totalDamageReceived, characterId);

  // Combat log
  db.prepare('INSERT INTO combat_logs (character_id, floor, room, enemy_name, outcome, turns_taken, damage_dealt, damage_received, xp_gained, gold_gained, log_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(characterId, char.current_floor, char.current_room, enemy.name, 'victory', state.turn, state.totalDamageDealt, state.totalDamageReceived, xpGained, goldGained, JSON.stringify(state.log.concat(turnLog)));

  // Loot drops
  const lootDrops = generateCombatLoot(char.current_floor, enemy.id);
  if (lootDrops.length > 0) {
    const insertItem = db.prepare('INSERT INTO inventory (character_id, item_id, name, type, rarity, stats, description, is_equipped, quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const item of lootDrops) {
      insertItem.run(characterId, item.item_id, item.name, item.type, item.rarity, item.stats, item.description, 0, item.quantity);
      turnLog.push({ type: 'loot', item, message: `Found: ${item.name} (${item.rarity})` });
    }
  }

  // Check achievements
  const achievements = checkAchievements(db, req.user.id, {
    enemyDefeated: true,
    bossDefeated: enemy.isBoss || false,
    currentFloor: char.current_floor,
    foundLegendary: lootDrops.some(i => i.rarity === 'legendary'),
    totalRuns: db.prepare('SELECT total_runs FROM users WHERE id = ?').get(req.user.id)?.total_runs || 0,
    totalGold: db.prepare('SELECT total_gold FROM users WHERE id = ?').get(req.user.id)?.total_gold || 0
  });

  if (achievements.length > 0) {
    turnLog.push({ type: 'achievement', achievements, message: `Achievement${achievements.length > 1 ? 's' : ''} unlocked!` });
  }

  delete combatStates[characterId];
  state.log.push(...turnLog);

  const updatedChar = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
  res.json({ combatState: sanitizeCombatState(state), turnLog, ongoing: false, victory: true, loot: lootDrops, achievements, character: updatedChar, leveledUp: levelUpResult.leveledUp });
}

function handleDeath(req, res, state, turnLog, db) {
  const { player, enemy, characterId } = state;

  turnLog.push({ type: 'death', message: 'You have fallen in battle...' });

  const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
  db.prepare('UPDATE characters SET is_alive = 0, run_status = ?, hp = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('dead', characterId);
  db.prepare('UPDATE users SET total_runs = total_runs + 1, deepest_floor = MAX(deepest_floor, ?), total_gold = total_gold + ? WHERE id = ?').run(char.current_floor, char.gold, req.user.id);

  // Combat log
  db.prepare('INSERT INTO combat_logs (character_id, floor, room, enemy_name, outcome, turns_taken, damage_dealt, damage_received, xp_gained, gold_gained, log_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(characterId, char.current_floor, char.current_room, enemy.name, 'defeat', state.turn, state.totalDamageDealt, state.totalDamageReceived, 0, 0, JSON.stringify(state.log.concat(turnLog)));

  // Generate echo reward
  const echoReward = generateEchoReward({
    lastEnemy: enemy.name.toLowerCase(),
    floorsCleared: char.current_floor,
    totalGold: char.gold,
    totalKills: char.enemies_defeated,
    totalRuns: db.prepare('SELECT total_runs FROM users WHERE id = ?').get(req.user.id)?.total_runs || 0
  });

  if (echoReward.perk) {
    db.prepare('INSERT INTO meta_unlocks (user_id, unlock_type, unlock_key, unlock_data) VALUES (?, ?, ?, ?)')
      .run(req.user.id, 'echo_perk', echoReward.perk.id, JSON.stringify(echoReward.perk));
  }

  delete combatStates[characterId];
  state.log.push(...turnLog);

  res.json({ combatState: sanitizeCombatState(state), turnLog, ongoing: false, victory: false, death: true, echoReward, character: db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId) });
}

// POST /api/combat/flee
router.post('/flee', authMiddleware, (req, res) => {
  try {
    const { characterId } = req.body;
    const state = combatStates[characterId];
    if (!state) return res.status(400).json({ error: 'No active combat.' });

    const fleeChance = 0.4 + (state.player.dex || 0) * 0.01;
    const fled = Math.random() < fleeChance;

    if (fled) {
      delete combatStates[characterId];
      const db = getDb();
      db.prepare('INSERT INTO combat_logs (character_id, floor, room, enemy_name, outcome, turns_taken, damage_dealt, damage_received, log_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(characterId, state.player.current_floor, state.player.current_room, state.enemy.name, 'fled', state.turn, state.totalDamageDealt, state.totalDamageReceived, '[]');
      return res.json({ fled: true, message: 'You fled successfully!' });
    }

    // Failed to flee - enemy gets a free hit
    const db = getDb();
    const dmg = calculateEnemyDamage(state.enemy, state.player.totalDef, state.player.class);
    state.player.hp = Math.max(0, state.player.hp - dmg);
    state.totalDamageReceived += dmg;
    db.prepare('UPDATE characters SET hp = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(state.player.hp, characterId);

    const turnLog = [
      { type: 'flee_fail', message: 'Failed to flee!' },
      { type: 'enemy_damage', amount: dmg, message: `${state.enemy.name} strikes as you stumble! ${dmg} damage!` }
    ];

    if (state.player.hp <= 0) {
      return handleDeath(req, res, state, turnLog, db);
    }

    state.log.push(...turnLog);
    res.json({ fled: false, combatState: sanitizeCombatState(state), turnLog });
  } catch (err) {
    console.error('Flee error:', err);
    res.status(500).json({ error: 'Server error fleeing.' });
  }
});

// GET /api/combat/:charId/log
router.get('/:charId/log', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const logs = db.prepare('SELECT * FROM combat_logs WHERE character_id = ? ORDER BY created_at DESC LIMIT 50').all(req.params.charId);
    res.json(logs);
  } catch (err) {
    console.error('Combat log error:', err);
    res.status(500).json({ error: 'Server error fetching combat logs.' });
  }
});

function sanitizeCombatState(state) {
  return {
    turn: state.turn,
    player: {
      hp: state.player.hp, maxHp: state.player.max_hp,
      sp: state.player.sp, maxSp: state.player.max_sp,
      str: state.player.str, intel: state.player.intel, dex: state.player.dex, vit: state.player.vit,
      level: state.player.level, class: state.player.class, name: state.player.name,
      statusEffects: state.player.statusEffects, isDefending: state.player.isDefending, isDodging: state.player.isDodging
    },
    enemy: {
      name: state.enemy.name, hp: state.enemy.hp, maxHp: state.enemy.maxHp,
      flavorText: state.enemy.flavorText, special: state.enemy.special,
      statusEffects: state.enemy.statusEffects, isBoss: state.enemy.isBoss || false
    }
  };
}

module.exports = router;
