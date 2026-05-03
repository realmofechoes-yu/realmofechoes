/**
 * Combat Engine - Core combat math and enemy AI
 */

const CLASS_SKILLS = {
  warrior: {
    skill1: { name: 'Cleave', description: 'A powerful sweeping attack', multiplier: 1.5, spCost: 15, stat: 'str', type: 'damage' },
    skill2: { name: 'Shield Bash', description: 'Stun enemy for 1 turn', multiplier: 1.0, spCost: 20, stat: 'str', type: 'stun', duration: 1 },
    passive: { name: 'Iron Skin', description: '+10% DEF', type: 'def_boost', value: 0.10 }
  },
  mage: {
    skill1: { name: 'Fireball', description: 'A blazing ball of fire', multiplier: 2.0, spCost: 20, stat: 'intel', type: 'damage' },
    skill2: { name: 'Frost Nova', description: 'Freezing blast that slows', multiplier: 1.5, spCost: 25, stat: 'intel', type: 'damage_slow', slowDuration: 2 },
    passive: { name: 'Arcane Focus', description: '+15% spell damage', type: 'spell_boost', value: 0.15 }
  },
  ranger: {
    skill1: { name: 'Power Shot', description: 'A precise, devastating arrow', multiplier: 1.8, spCost: 12, stat: 'dex', type: 'damage' },
    skill2: { name: 'Smoke Bomb', description: 'Dodge the next attack', multiplier: 0, spCost: 18, stat: 'dex', type: 'dodge', duration: 1 },
    passive: { name: 'Eagle Eye', description: '+10% crit chance', type: 'crit_boost', value: 0.10 }
  }
};

const CLASS_MODIFIERS = {
  warrior: { atkStat: 'str', defBonus: 1.1, atkBonus: 1.0, critBase: 0.05 },
  mage: { atkStat: 'intel', defBonus: 0.9, atkBonus: 1.15, critBase: 0.05 },
  ranger: { atkStat: 'dex', defBonus: 0.95, atkBonus: 1.05, critBase: 0.15 }
};

function calculateDamage(attacker, defender, isSkill = false, skillData = null) {
  const classMod = CLASS_MODIFIERS[attacker.class] || { atkStat: 'str', atkBonus: 1.0, critBase: 0.05 };
  const mainStat = attacker[classMod.atkStat] || attacker.atk || 10;
  const weaponPower = attacker.weaponPower || 0;

  let baseDamage;
  if (isSkill && skillData) {
    const skillStat = attacker[skillData.stat] || mainStat;
    baseDamage = (skillStat * 2 + weaponPower) * skillData.multiplier;
    if (attacker.class === 'mage' && CLASS_SKILLS.mage.passive) {
      baseDamage *= (1 + CLASS_SKILLS.mage.passive.value);
    }
  } else {
    baseDamage = (mainStat * 2 + weaponPower) * classMod.atkBonus;
  }

  const defenseReduction = 1 - Math.min((defender.def || 0) / 100, 0.75);
  const rng = 0.85 + Math.random() * 0.30;
  let finalDamage = Math.floor(baseDamage * defenseReduction * rng);

  // Crit check
  const critChance = classMod.critBase + (attacker.dex || 0) / 200;
  const isCrit = Math.random() < critChance;
  if (isCrit) finalDamage = Math.floor(finalDamage * 1.5);

  return { damage: Math.max(1, finalDamage), isCrit };
}

function calculateEnemyDamage(enemy, playerDef, playerClass) {
  const classMod = CLASS_MODIFIERS[playerClass] || { defBonus: 1.0 };
  const effectiveDef = Math.floor(playerDef * classMod.defBonus);
  const defenseReduction = 1 - Math.min(effectiveDef / 100, 0.75);
  const rng = 0.85 + Math.random() * 0.30;
  const damage = Math.floor(enemy.atk * 2 * defenseReduction * rng);
  return Math.max(1, damage);
}

function getDefendReduction() {
  return 0.5; // 50% damage reduction when defending
}

function enemyAI(enemy, playerState) {
  const hpPercent = enemy.hp / enemy.maxHp;
  const actions = [];

  // Low HP: try to heal or defend
  if (hpPercent < 0.3 && enemy.special) {
    if (enemy.special.type === 'heal') {
      actions.push({ action: 'special', weight: 0.6 });
    }
    if (enemy.special.type === 'buff_defense') {
      actions.push({ action: 'special', weight: 0.5 });
    }
    actions.push({ action: 'attack', weight: 0.4 });
  }
  // Medium HP: mix of attacks and specials
  else if (hpPercent < 0.6 && enemy.special) {
    actions.push({ action: 'special', weight: 0.4 });
    actions.push({ action: 'attack', weight: 0.6 });
  }
  // High HP: mostly attack, occasional special
  else {
    actions.push({ action: 'attack', weight: 0.7 });
    if (enemy.special) {
      actions.push({ action: 'special', weight: 0.3 });
    }
  }

  // Weighted random selection
  const totalWeight = actions.reduce((sum, a) => sum + a.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const a of actions) {
    roll -= a.weight;
    if (roll <= 0) return a.action;
  }
  return 'attack';
}

function resolveEnemyAction(enemy, player) {
  const action = enemyAI(enemy, player);
  const events = [];

  if (action === 'special' && enemy.special) {
    const sp = enemy.special;
    switch (sp.type) {
      case 'double_attack': {
        const dmg1 = calculateEnemyDamage(enemy, player.totalDef, player.class);
        const dmg2 = calculateEnemyDamage(enemy, player.totalDef, player.class);
        const d1 = Math.floor(dmg1 * sp.modifier);
        const d2 = Math.floor(dmg2 * sp.modifier);
        events.push({ type: 'enemy_special', name: sp.name, description: sp.description });
        events.push({ type: 'damage_player', amount: d1 });
        events.push({ type: 'damage_player', amount: d2 });
        return { totalDamage: d1 + d2, events };
      }
      case 'buff_defense':
        events.push({ type: 'enemy_special', name: sp.name, description: sp.description });
        events.push({ type: 'enemy_buff', stat: 'def', modifier: sp.modifier, duration: sp.duration });
        return { totalDamage: 0, events };
      case 'dot':
        const dotDmg = calculateEnemyDamage(enemy, player.totalDef, player.class);
        events.push({ type: 'enemy_special', name: sp.name, description: sp.description });
        events.push({ type: 'damage_player', amount: dotDmg });
        events.push({ type: 'apply_dot', target: 'player', damage: sp.damage, duration: sp.duration, name: sp.name });
        return { totalDamage: dotDmg, events };
      case 'stun':
        const stunDmg = calculateEnemyDamage(enemy, player.totalDef, player.class);
        const stunned = Math.random() < sp.chance;
        events.push({ type: 'enemy_special', name: sp.name, description: sp.description });
        events.push({ type: 'damage_player', amount: stunDmg });
        if (stunned) events.push({ type: 'stun_player', duration: 1 });
        return { totalDamage: stunDmg, events };
      case 'sp_drain':
        const drainDmg = calculateEnemyDamage(enemy, player.totalDef, player.class);
        events.push({ type: 'enemy_special', name: sp.name, description: sp.description });
        events.push({ type: 'damage_player', amount: drainDmg });
        events.push({ type: 'drain_sp', amount: sp.amount });
        return { totalDamage: drainDmg, events };
      case 'heal':
        const healAmt = Math.min(sp.amount, enemy.maxHp - enemy.hp);
        events.push({ type: 'enemy_special', name: sp.name, description: sp.description });
        events.push({ type: 'enemy_heal', amount: healAmt });
        return { totalDamage: 0, healAmount: healAmt, events };
    }
  }

  // Default attack
  const dmg = calculateEnemyDamage(enemy, player.totalDef, player.class);
  events.push({ type: 'enemy_attack', amount: dmg });
  events.push({ type: 'damage_player', amount: dmg });
  return { totalDamage: dmg, events };
}

function calculateXpForLevel(level) {
  return level * 100;
}

function checkLevelUp(currentXp, currentLevel) {
  const needed = calculateXpForLevel(currentLevel);
  if (currentXp >= needed) {
    return { leveledUp: true, remainingXp: currentXp - needed, statPoints: 3 };
  }
  return { leveledUp: false };
}

module.exports = {
  CLASS_SKILLS, CLASS_MODIFIERS,
  calculateDamage, calculateEnemyDamage, getDefendReduction,
  enemyAI, resolveEnemyAction, calculateXpForLevel, checkLevelUp
};
