/**
 * Echo System - Meta-progression, lore fragments, and echo perks
 */

const LORE_FRAGMENTS = [
  { id: 'lore_01', text: '"The walls remember every footstep, every blade drawn in anger."', theme: 'general' },
  { id: 'lore_02', text: '"In the Forgotten Crypt, the dead do not rest — they wait."', theme: 'crypt' },
  { id: 'lore_03', text: '"The fungi grow not from soil, but from the dreams of the buried."', theme: 'cavern' },
  { id: 'lore_04', text: '"The Ember King was once a hero. Power consumed him, as it consumes all."', theme: 'ember' },
  { id: 'lore_05', text: '"Ice preserves what fire destroys. Both are merciless."', theme: 'frost' },
  { id: 'lore_06', text: '"Every echo was once a voice. Every voice was once a life."', theme: 'echo' },
  { id: 'lore_07', text: '"The dungeon feeds on ambition. It grows with every soul that enters."', theme: 'general' },
  { id: 'lore_08', text: '"There is no final floor. Only the last one you survive."', theme: 'general' },
  { id: 'lore_09', text: '"The Guardian remembers you. It always remembers."', theme: 'echo' },
  { id: 'lore_10', text: '"Gold means nothing in the deep. Only steel and will matter."', theme: 'general' }
];

const ECHO_PERKS = [
  { id: 'echo_fire_res', name: 'Ember Memory', description: '+5% fire resistance on next run', effect: { type: 'damage_reduction', element: 'fire', value: 0.05 }, condition: 'died_to_fire' },
  { id: 'echo_frost_res', name: 'Frozen Recall', description: '+5% frost resistance on next run', effect: { type: 'damage_reduction', element: 'frost', value: 0.05 }, condition: 'died_to_frost' },
  { id: 'echo_hp_boost', name: 'Vital Echo', description: '+10 max HP on next run', effect: { type: 'stat_boost', stat: 'max_hp', value: 10 }, condition: 'completed_floor_3' },
  { id: 'echo_sp_boost', name: 'Spirit Echo', description: '+5 max SP on next run', effect: { type: 'stat_boost', stat: 'max_sp', value: 5 }, condition: 'completed_floor_2' },
  { id: 'echo_gold', name: 'Fortune Echo', description: '+10% gold from enemies', effect: { type: 'gold_boost', value: 0.10 }, condition: 'total_gold_500' },
  { id: 'echo_crit', name: 'Sharpened Echo', description: '+3% crit chance', effect: { type: 'crit_boost', value: 0.03 }, condition: 'total_kills_20' },
  { id: 'echo_start_pot', name: 'Prepared Echo', description: 'Start with 2 extra Health Potions', effect: { type: 'starting_item', item: 'health_potion', count: 2 }, condition: 'total_runs_5' },
  { id: 'echo_xp', name: 'Wisdom Echo', description: '+10% XP gained', effect: { type: 'xp_boost', value: 0.10 }, condition: 'total_runs_10' }
];

const ACHIEVEMENT_DEFINITIONS = [
  { key: 'first_blood', name: 'First Blood', description: 'Defeat your first enemy', icon: '⚔️' },
  { key: 'floor_3', name: 'Deep Delver', description: 'Reach floor 3', icon: '🏔️' },
  { key: 'floor_5', name: 'Abyss Walker', description: 'Reach floor 5', icon: '🌑' },
  { key: 'boss_kill', name: 'Boss Slayer', description: 'Defeat a boss', icon: '👑' },
  { key: 'zero_death_floor', name: 'Untouchable', description: 'Clear a floor without taking damage', icon: '🛡️' },
  { key: 'legendary_loot', name: 'Golden Touch', description: 'Find a legendary item', icon: '✨' },
  { key: 'runs_5', name: 'Persistent', description: 'Complete 5 runs', icon: '🔄' },
  { key: 'runs_10', name: 'Veteran', description: 'Complete 10 runs', icon: '⭐' },
  { key: 'gold_1000', name: 'Treasure Hunter', description: 'Accumulate 1000 total gold', icon: '💰' },
  { key: 'all_classes', name: 'Versatile', description: 'Play all three classes', icon: '🎭' }
];

function generateEchoReward(runData) {
  const lore = LORE_FRAGMENTS[Math.floor(Math.random() * LORE_FRAGMENTS.length)];
  const eligiblePerks = ECHO_PERKS.filter(p => {
    if (p.condition === 'died_to_fire' && runData.lastEnemy && runData.lastEnemy.includes('flame')) return true;
    if (p.condition === 'died_to_frost' && runData.lastEnemy && runData.lastEnemy.includes('frost')) return true;
    if (p.condition === 'completed_floor_3' && runData.floorsCleared >= 3) return true;
    if (p.condition === 'completed_floor_2' && runData.floorsCleared >= 2) return true;
    if (p.condition === 'total_gold_500' && runData.totalGold >= 500) return true;
    if (p.condition === 'total_kills_20' && runData.totalKills >= 20) return true;
    if (p.condition === 'total_runs_5' && runData.totalRuns >= 5) return true;
    if (p.condition === 'total_runs_10' && runData.totalRuns >= 10) return true;
    return false;
  });

  const perk = eligiblePerks.length > 0 ? eligiblePerks[Math.floor(Math.random() * eligiblePerks.length)] : null;
  return { lore, perk };
}

function checkAchievements(db, userId, eventData) {
  const unlocked = [];
  const existing = db.prepare('SELECT achievement_key FROM achievements WHERE user_id = ?').all(userId).map(a => a.achievement_key);
  const insert = db.prepare('INSERT OR IGNORE INTO achievements (user_id, achievement_key, achievement_name, description, icon) VALUES (?, ?, ?, ?, ?)');

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
      insert.run(userId, ach.key, ach.name, ach.description, ach.icon);
      unlocked.push(ach);
    }
  }
  return unlocked;
}

module.exports = { LORE_FRAGMENTS, ECHO_PERKS, ACHIEVEMENT_DEFINITIONS, generateEchoReward, checkAchievements };
