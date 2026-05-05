const express = require('express');
const { getOne, getAll, run } = require('../db/database');
const authMiddleware = require('../middleware/auth');
const { calculateDamage, calculateEnemyDamage, getDefendReduction, resolveEnemyAction, checkLevelUp, CLASS_SKILLS } = require('../game/combat-engine');
const { generateCombatLoot } = require('../game/loot-generator');
const { checkAchievements, generateEchoReward } = require('../game/echo-system');

const router = express.Router();

// In-memory combat states (keyed by character id)
const combatStates = {};

// GET /api/combat/active/:characterId
router.get('/active/:characterId', authMiddleware, (req, res) => {
  const state = combatStates[req.params.characterId];
  if (!state) return res.status(404).json({ error: 'No active combat.' });
  res.json({ combatState: state, skills: CLASS_SKILLS[state.player.class] });
});

// POST /api/combat/start
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { characterId, enemy } = req.body;
    const char = await getOne('SELECT * FROM characters WHERE id = $1 AND user_id = $2', [characterId, req.user.id]);
    if (!char) return res.status(404).json({ error: 'Character not found.' });

    const weapon = await getOne("SELECT * FROM inventory WHERE character_id = $1 AND type = 'weapon' AND is_equipped = TRUE", [char.id]);
    let weaponPower = 0;
    if (weapon) {
      try {
        const stats = JSON.parse(weapon.stats);
        weaponPower = Object.values(stats).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
      } catch (e) { /* ignore */ }
    }

    const armor = await getOne("SELECT * FROM inventory WHERE character_id = $1 AND type = 'armor' AND is_equipped = TRUE", [char.id]);
    let armorDef = 0;
    if (armor) {
      try {
        const stats = JSON.parse(armor.stats);
        armorDef = stats.vit || stats.def || 0;
      } catch (e) { /* ignore */ }
    }

    const combatState = {
      characterId: char.id,
      player: { ...char, weaponPower, totalDef: char.vit + armorDef, statusEffects: [], isDefending: false, isDodging: false },
      enemy: { ...enemy, statusEffects: [], buffedDef: 0 },
      turn: 1, log: [], totalDamageDealt: 0, totalDamageReceived: 0
    };

    combatStates[char.id] = combatState;
    res.json({ combatState: sanitizeCombatState(combatState), skills: CLASS_SKILLS[char.class] });
  } catch (err) {
    console.error('Combat start error:', err);
    res.status(500).json({ error: 'Server error starting combat.' });
  }
});

// POST /api/combat/action
router.post('/action', authMiddleware, async (req, res) => {
  try {
    const { characterId, action, skillKey, itemId } = req.body;
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
          const item = await getOne('SELECT * FROM inventory WHERE id = $1 AND character_id = $2', [itemId, characterId]);
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
            await run('UPDATE inventory SET quantity = quantity - 1 WHERE id = $1', [item.id]);
          } else {
            await run('DELETE FROM inventory WHERE id = $1', [item.id]);
          }
          break;
        }
      }
    }

    if (enemy.hp <= 0) {
      return handleVictory(req, res, state, turnLog);
    }

    // Enemy turn
    const enemyStunned = enemy.statusEffects.findIndex(e => e.type === 'stun');
    if (enemyStunned >= 0) {
      turnLog.push({ type: 'stunned', target: 'enemy', message: `${enemy.name} is stunned and cannot act!` });
      enemy.statusEffects.splice(enemyStunned, 1);
    } else {
      if (player.isDodging) {
        turnLog.push({ type: 'dodge', message: `${enemy.name} attacks but you dodge!` });
      } else {
        const enemyResult = resolveEnemyAction(enemy, player);
        let damageToPlayer = enemyResult.totalDamage;
        if (player.isDefending) damageToPlayer = Math.floor(damageToPlayer * getDefendReduction());
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

    if (player.hp <= 0) {
      return handleDeath(req, res, state, turnLog);
    }

    state.turn++;
    state.log.push(...turnLog);
    await run('UPDATE characters SET hp = $1, sp = $2, updated_at = NOW() WHERE id = $3', [player.hp, player.sp, characterId]);
    res.json({ combatState: sanitizeCombatState(state), turnLog, ongoing: true });
  } catch (err) {
    console.error('Combat action error:', err);
    res.status(500).json({ error: 'Server error processing combat action.' });
  }
});

async function handleVictory(req, res, state, turnLog) {
  const { player, enemy, characterId } = state;
  const xpGained = enemy.xpReward || 20;
  const goldGained = enemy.goldReward || 10;
  turnLog.push({ type: 'victory', message: `${enemy.name} has been defeated!` });
  turnLog.push({ type: 'reward', xp: xpGained, gold: goldGained, message: `Gained ${xpGained} XP and ${goldGained} gold!` });

  const char = await getOne('SELECT * FROM characters WHERE id = $1', [characterId]);
  let newXp = char.xp + xpGained;
  let newLevel = char.level;
  let newStatPoints = char.stat_points;
  const levelUpResult = checkLevelUp(newXp, newLevel);
  if (levelUpResult.leveledUp) {
    newXp = levelUpResult.remainingXp;
    newLevel++;
    newStatPoints += levelUpResult.statPoints;
    player.hp = Math.min(player.hp + 20, player.max_hp);
    player.sp = Math.min(player.sp + 15, player.max_sp);
    turnLog.push({ type: 'level_up', level: newLevel, statPoints: levelUpResult.statPoints, message: `Level up! Now level ${newLevel}! +${levelUpResult.statPoints} stat points!` });
  }

  await run('UPDATE characters SET xp=$1, level=$2, stat_points=$3, gold=gold+$4, hp=$5, sp=$6, current_room = current_room + 1, rooms_cleared = rooms_cleared + 1, enemies_defeated=enemies_defeated+1, damage_dealt_total=damage_dealt_total+$7, damage_received_total=damage_received_total+$8, updated_at=NOW() WHERE id=$9',
    [newXp, newLevel, newStatPoints, goldGained, player.hp, player.sp, state.totalDamageDealt, state.totalDamageReceived, characterId]);

  await run('INSERT INTO combat_logs (character_id,floor,room,enemy_name,outcome,turns_taken,damage_dealt,damage_received,xp_gained,gold_gained,log_data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    [characterId, char.current_floor, char.current_room, enemy.name, 'victory', state.turn, state.totalDamageDealt, state.totalDamageReceived, xpGained, goldGained, JSON.stringify(state.log.concat(turnLog))]);

  const lootDrops = generateCombatLoot(char.current_floor, enemy.id);
  if (lootDrops.length > 0) {
    for (const item of lootDrops) {
      await run('INSERT INTO inventory (character_id,item_id,name,type,rarity,stats,description,is_equipped,quantity) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [characterId, item.item_id, item.name, item.type, item.rarity, item.stats, item.description, false, item.quantity]);
      turnLog.push({ type: 'loot', item, message: `Found: ${item.name} (${item.rarity})` });
    }
  }

  const achievements = await checkAchievementsAsync(req.user.id, {
    enemyDefeated: true, bossDefeated: enemy.isBoss || false,
    currentFloor: char.current_floor, foundLegendary: lootDrops.some(i => i.rarity === 'legendary'),
    totalRuns: (await getOne('SELECT total_runs FROM users WHERE id = $1', [req.user.id]))?.total_runs || 0,
    totalGold: (await getOne('SELECT total_gold FROM users WHERE id = $1', [req.user.id]))?.total_gold || 0
  });
  if (achievements.length > 0) {
    turnLog.push({ type: 'achievement', achievements, message: `Achievement${achievements.length > 1 ? 's' : ''} unlocked!` });
  }

  delete combatStates[characterId];
  state.log.push(...turnLog);
  const updatedChar = await getOne('SELECT * FROM characters WHERE id = $1', [characterId]);
  res.json({ combatState: sanitizeCombatState(state), turnLog, ongoing: false, victory: true, loot: lootDrops, achievements, character: updatedChar, leveledUp: levelUpResult.leveledUp });
}

async function handleDeath(req, res, state, turnLog) {
  const { player, enemy, characterId } = state;
  turnLog.push({ type: 'death', message: 'You have fallen in battle...' });

  const char = await getOne('SELECT * FROM characters WHERE id = $1', [characterId]);
  await run('UPDATE characters SET is_alive = FALSE, run_status = $1, hp = 0, updated_at = NOW() WHERE id = $2', ['dead', characterId]);
  await run('UPDATE users SET total_runs = total_runs + 1, deepest_floor = GREATEST(deepest_floor, $1), total_gold = total_gold + $2 WHERE id = $3', [char.current_floor, char.gold, req.user.id]);

  await run('INSERT INTO combat_logs (character_id,floor,room,enemy_name,outcome,turns_taken,damage_dealt,damage_received,xp_gained,gold_gained,log_data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    [characterId, char.current_floor, char.current_room, enemy.name, 'defeat', state.turn, state.totalDamageDealt, state.totalDamageReceived, 0, 0, JSON.stringify(state.log.concat(turnLog))]);

  const echoReward = generateEchoReward({
    lastEnemy: enemy.name.toLowerCase(), floorsCleared: char.current_floor,
    totalGold: char.gold, totalKills: char.enemies_defeated,
    totalRuns: (await getOne('SELECT total_runs FROM users WHERE id = $1', [req.user.id]))?.total_runs || 0
  });
  if (echoReward.perk) {
    await run('INSERT INTO meta_unlocks (user_id, unlock_type, unlock_key, unlock_data) VALUES ($1,$2,$3,$4)',
      [req.user.id, 'echo_perk', echoReward.perk.id, JSON.stringify(echoReward.perk)]);
  }

  delete combatStates[characterId];
  state.log.push(...turnLog);
  const updatedChar = await getOne('SELECT * FROM characters WHERE id = $1', [characterId]);
  res.json({ combatState: sanitizeCombatState(state), turnLog, ongoing: false, victory: false, death: true, echoReward, character: updatedChar });
}

// POST /api/combat/flee
router.post('/flee', authMiddleware, async (req, res) => {
  try {
    const { characterId } = req.body;
    const state = combatStates[characterId];
    if (!state) return res.status(400).json({ error: 'No active combat.' });
    const fleeChance = 0.4 + (state.player.dex || 0) * 0.01;
    const fled = Math.random() < fleeChance;
    if (fled) {
      delete combatStates[characterId];
      await run('INSERT INTO combat_logs (character_id,floor,room,enemy_name,outcome,turns_taken,damage_dealt,damage_received,log_data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [characterId, state.player.current_floor, state.player.current_room, state.enemy.name, 'fled', state.turn, state.totalDamageDealt, state.totalDamageReceived, '[]']);
      return res.json({ fled: true, message: 'You fled successfully!' });
    }
    const dmg = calculateEnemyDamage(state.enemy, state.player.totalDef, state.player.class);
    state.player.hp = Math.max(0, state.player.hp - dmg);
    state.totalDamageReceived += dmg;
    await run('UPDATE characters SET hp = $1, updated_at = NOW() WHERE id = $2', [state.player.hp, characterId]);
    const turnLog = [
      { type: 'flee_fail', message: 'Failed to flee!' },
      { type: 'enemy_damage', amount: dmg, message: `${state.enemy.name} strikes as you stumble! ${dmg} damage!` }
    ];
    if (state.player.hp <= 0) return handleDeath(req, res, state, turnLog);
    state.log.push(...turnLog);
    res.json({ fled: false, combatState: sanitizeCombatState(state), turnLog });
  } catch (err) {
    console.error('Flee error:', err);
    res.status(500).json({ error: 'Server error fleeing.' });
  }
});

// GET /api/combat/:charId/log
router.get('/:charId/log', authMiddleware, async (req, res) => {
  try {
    const logs = await getAll('SELECT * FROM combat_logs WHERE character_id = $1 ORDER BY created_at DESC LIMIT 50', [req.params.charId]);
    res.json(logs);
  } catch (err) {
    console.error('Combat log error:', err);
    res.status(500).json({ error: 'Server error fetching combat logs.' });
  }
});

// Async version of checkAchievements for PostgreSQL
const { ACHIEVEMENT_DEFINITIONS } = require('../game/echo-system');
async function checkAchievementsAsync(userId, eventData) {
  const unlocked = [];
  const existingRows = await getAll('SELECT achievement_key FROM achievements WHERE user_id = $1', [userId]);
  const existing = existingRows.map(a => a.achievement_key);
  for (const ach of ACHIEVEMENT_DEFINITIONS) {
    if (existing.includes(ach.key)) continue;
    let earned = false;
    switch (ach.key) {
      case 'first_blood': earned = eventData.enemyDefeated; break;
      case 'floor_3': earned = eventData.currentFloor >= 3; break;
      case 'floor_5': earned = eventData.currentFloor >= 5; break;
      case 'boss_kill': earned = eventData.bossDefeated; break;
      case 'legendary_loot': earned = eventData.foundLegendary; break;
      case 'runs_5': earned = eventData.totalRuns >= 5; break;
      case 'runs_10': earned = eventData.totalRuns >= 10; break;
      case 'gold_1000': earned = eventData.totalGold >= 1000; break;
    }
    if (earned) {
      await run('INSERT INTO achievements (user_id,achievement_key,achievement_name,description,icon) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id,achievement_key) DO NOTHING',
        [userId, ach.key, ach.name, ach.description, ach.icon]);
      unlocked.push(ach);
    }
  }
  return unlocked;
}

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
      statusEffects: state.enemy.statusEffects, isBoss: state.enemy.isBoss || false,
      sprite: state.enemy.sprite, sprites: state.enemy.sprites
    }
  };
}

module.exports = router;
