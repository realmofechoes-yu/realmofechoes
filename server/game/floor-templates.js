const ROOM_TYPES = { COMBAT: 'combat', TREASURE: 'treasure', SHRINE: 'shrine', TRAP: 'trap', BOSS: 'boss', REST: 'rest' };

const ENEMIES = {
  shadow_rat: { id: 'shadow_rat', name: 'Shadow Rat', hp: 20, maxHp: 20, atk: 5, def: 2, spd: 8, xpReward: 15, goldReward: 5, special: { name: 'Quick Strike', description: 'Attacks twice for half damage each', type: 'double_attack', modifier: 0.5 }, flavorText: 'A skittering shadow with red, gleaming eyes.' },
  hollow_knight: { id: 'hollow_knight', name: 'Hollow Knight', sprite: '/sprites/hollow_knight.png', hp: 45, maxHp: 45, atk: 12, def: 10, spd: 4, xpReward: 30, goldReward: 12, special: { name: 'Shield Wall', description: '+50% DEF for 1 turn', type: 'buff_defense', modifier: 1.5, duration: 1 }, flavorText: 'An animated suit of ancient armor, empty within.' },
  flame_wraith: { id: 'flame_wraith', name: 'Flame Wraith', hp: 35, maxHp: 35, atk: 15, def: 3, spd: 6, xpReward: 35, goldReward: 15, special: { name: 'Burn', description: 'Inflicts 3 damage per turn for 2 turns', type: 'dot', damage: 3, duration: 2 }, flavorText: 'A flickering spirit wreathed in ghostly flames.' },
  frost_widow: { id: 'frost_widow', name: 'Frost Widow', hp: 30, maxHp: 30, atk: 10, def: 5, spd: 7, xpReward: 30, goldReward: 10, special: { name: 'Freeze', description: '20% chance to skip player turn', type: 'stun', chance: 0.2 }, flavorText: 'An ice-encrusted arachnid that crackles with frost.' },
  venom_crawler: { id: 'venom_crawler', name: 'Venom Crawler', hp: 40, maxHp: 40, atk: 8, def: 6, spd: 5, xpReward: 28, goldReward: 11, special: { name: 'Poison', description: '4 damage per turn for 3 turns', type: 'dot', damage: 4, duration: 3 }, flavorText: 'A many-legged horror dripping with vile toxin.' },
  echoed_guardian: { id: 'echoed_guardian', name: 'Echoed Guardian', hp: 60, maxHp: 60, atk: 14, def: 12, spd: 3, xpReward: 50, goldReward: 25, special: { name: 'Echo Drain', description: 'Steals 5 SP from the player', type: 'sp_drain', amount: 5 }, flavorText: 'A spectral warrior from a past life, bound to guard eternity.' }
};

const BOSSES = {
  crypt_lord: { id: 'crypt_lord', name: 'Crypt Lord', hp: 80, maxHp: 80, atk: 16, def: 14, spd: 3, xpReward: 100, goldReward: 50, special: { name: 'Raise Dead', description: 'Heals 15 HP', type: 'heal', amount: 15 }, flavorText: 'The undying master of these forgotten halls.', isBoss: true },
  ember_king: { id: 'ember_king', name: 'Ember King', hp: 100, maxHp: 100, atk: 20, def: 10, spd: 5, xpReward: 150, goldReward: 75, special: { name: 'Inferno', description: 'Massive fire attack + burn for 3 turns', type: 'dot', damage: 5, duration: 3 }, flavorText: 'A titanic figure of living flame and molten rage.', isBoss: true },
  echo_wraith: { id: 'echo_wraith', name: 'Echo Wraith', hp: 120, maxHp: 120, atk: 18, def: 15, spd: 6, xpReward: 200, goldReward: 100, special: { name: 'Soul Shatter', description: 'Drains 10 SP and deals bonus damage', type: 'sp_drain', amount: 10 }, flavorText: 'The amalgamation of countless fallen adventurers.', isBoss: true }
};

const FLOOR_TEMPLATES = [
  { id: 1, name: 'Forgotten Crypt', description: 'Dusty corridors lined with crumbling sarcophagi.', rooms: [
    { index: 0, type: ROOM_TYPES.COMBAT, enemyPool: ['shadow_rat'], description: 'A narrow passage filled with scratching sounds.' },
    { index: 1, type: ROOM_TYPES.TREASURE, description: 'A hidden alcove with a dusty chest.' },
    { index: 2, type: ROOM_TYPES.COMBAT, enemyPool: ['shadow_rat', 'hollow_knight'], description: 'A burial chamber guarded by ancient sentinels.' }
  ]},
  { id: 2, name: 'Fungal Caverns', description: 'Bioluminescent mushrooms light twisting cave paths.', rooms: [
    { index: 0, type: ROOM_TYPES.COMBAT, enemyPool: ['venom_crawler'], description: 'Webbed tunnels writhing with crawlers.' },
    { index: 1, type: ROOM_TYPES.SHRINE, description: 'A glowing mushroom shrine pulses with healing energy.', shrineEffect: { type: 'heal', amount: 20 } },
    { index: 2, type: ROOM_TYPES.TRAP, description: 'Toxic spores erupt from the floor!', trapDamage: 8 },
    { index: 3, type: ROOM_TYPES.COMBAT, enemyPool: ['venom_crawler', 'frost_widow'], description: 'A cavern where predators lurk in the shadows.' }
  ]},
  { id: 3, name: 'Ember Halls', description: 'Rivers of magma wind through obsidian corridors.', rooms: [
    { index: 0, type: ROOM_TYPES.COMBAT, enemyPool: ['flame_wraith'], description: 'Flames dance along the walls.' },
    { index: 1, type: ROOM_TYPES.COMBAT, enemyPool: ['flame_wraith', 'hollow_knight'], description: 'An armory engulfed in eternal flame.' },
    { index: 2, type: ROOM_TYPES.TREASURE, description: 'A volcanic forge with unclaimed weapons.' },
    { index: 3, type: ROOM_TYPES.BOSS, enemyId: 'ember_king', description: 'The throne room of the Ember King.' }
  ]},
  { id: 4, name: 'Frozen Depths', description: 'Ice-encrusted tunnels that echo with howling wind.', rooms: [
    { index: 0, type: ROOM_TYPES.TRAP, description: 'The floor cracks — freezing water surges up!', trapDamage: 10 },
    { index: 1, type: ROOM_TYPES.COMBAT, enemyPool: ['frost_widow'], description: 'Crystalline webs span a frozen chasm.' },
    { index: 2, type: ROOM_TYPES.SHRINE, description: 'An ice altar radiates warmth.', shrineEffect: { type: 'restore_sp', amount: 15 } },
    { index: 3, type: ROOM_TYPES.COMBAT, enemyPool: ['frost_widow', 'echoed_guardian'], description: 'Spectral guardians patrol the ice bridge.' },
    { index: 4, type: ROOM_TYPES.COMBAT, enemyPool: ['echoed_guardian'], description: 'The final frozen corridor.' }
  ]},
  { id: 5, name: 'Echo Chamber', description: 'Reality fractures here. Shadows flicker at the edges.', rooms: [
    { index: 0, type: ROOM_TYPES.COMBAT, enemyPool: ['echoed_guardian', 'hollow_knight'], description: 'Echoes of fallen warriors materialize.' },
    { index: 1, type: ROOM_TYPES.REST, description: 'A pocket of calm. The echoes whisper encouragement.', restoreHp: 15, restoreSp: 10 },
    { index: 2, type: ROOM_TYPES.BOSS, enemyId: 'echo_wraith', description: 'The heart of the Echo Chamber.' }
  ]}
];

function getFloorTemplate(floorNumber) {
  const index = Math.min(floorNumber - 1, FLOOR_TEMPLATES.length - 1);
  return JSON.parse(JSON.stringify(FLOOR_TEMPLATES[index]));
}

function getEnemy(enemyId) {
  if (BOSSES[enemyId]) return JSON.parse(JSON.stringify(BOSSES[enemyId]));
  if (ENEMIES[enemyId]) return JSON.parse(JSON.stringify(ENEMIES[enemyId]));
  return null;
}

function getRandomEnemy(enemyPool) {
  const id = enemyPool[Math.floor(Math.random() * enemyPool.length)];
  return getEnemy(id);
}

function scaleEnemy(enemy, floor) {
  const scale = 1 + (floor - 1) * 0.15;
  enemy.hp = Math.floor(enemy.hp * scale);
  enemy.maxHp = Math.floor(enemy.maxHp * scale);
  enemy.atk = Math.floor(enemy.atk * scale);
  enemy.def = Math.floor(enemy.def * scale);
  enemy.xpReward = Math.floor(enemy.xpReward * scale);
  enemy.goldReward = Math.floor(enemy.goldReward * scale);
  return enemy;
}

module.exports = { ROOM_TYPES, ENEMIES, BOSSES, FLOOR_TEMPLATES, getFloorTemplate, getEnemy, getRandomEnemy, scaleEnemy };
