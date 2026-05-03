/**
 * Loot Generator - Item generation with rarity rolls and stat randomization
 */
const { v4: uuidv4 } = require('uuid');

const RARITY_WEIGHTS = [
  { rarity: 'common', weight: 50, statRange: [1, 3], color: '#9e9ba8' },
  { rarity: 'uncommon', weight: 30, statRange: [2, 5], color: '#4a9e6e' },
  { rarity: 'rare', weight: 13, statRange: [4, 8], color: '#5b9bd5' },
  { rarity: 'epic', weight: 5, statRange: [6, 12], color: '#7b5ea7' },
  { rarity: 'legendary', weight: 2, statRange: [10, 18], color: '#d4a347' }
];

const WEAPON_TEMPLATES = [
  { name: 'Rusty Sword', type: 'weapon', baseStat: 'str', description: 'A battered blade, still sharp enough.' },
  { name: 'Iron Mace', type: 'weapon', baseStat: 'str', description: 'Heavy and brutal.' },
  { name: 'Arcane Staff', type: 'weapon', baseStat: 'intel', description: 'Hums with latent magic.' },
  { name: 'Crystal Wand', type: 'weapon', baseStat: 'intel', description: 'Channels elemental energy.' },
  { name: 'Hunting Bow', type: 'weapon', baseStat: 'dex', description: 'Precise and deadly at range.' },
  { name: 'Shadow Daggers', type: 'weapon', baseStat: 'dex', description: 'Twin blades for swift strikes.' },
  { name: 'Flame Blade', type: 'weapon', baseStat: 'str', description: 'Wreathed in eternal embers.' },
  { name: 'Frost Edge', type: 'weapon', baseStat: 'intel', description: 'Cold radiates from the blade.' },
  { name: 'Venom Fang', type: 'weapon', baseStat: 'dex', description: 'Drips with paralyzing toxin.' },
  { name: 'Echo Glaive', type: 'weapon', baseStat: 'str', description: 'Resonates with spectral power.' }
];

const ARMOR_TEMPLATES = [
  { name: 'Leather Vest', type: 'armor', baseStat: 'vit', description: 'Basic but reliable protection.' },
  { name: 'Chain Mail', type: 'armor', baseStat: 'vit', description: 'Interlocking rings of steel.' },
  { name: 'Mage Robes', type: 'armor', baseStat: 'intel', description: 'Enchanted cloth that bolsters magic.' },
  { name: 'Shadow Cloak', type: 'armor', baseStat: 'dex', description: 'Bends light around the wearer.' },
  { name: 'Plate Armor', type: 'armor', baseStat: 'vit', description: 'Heavy, unyielding protection.' },
  { name: 'Ember Guard', type: 'armor', baseStat: 'str', description: 'Forged in volcanic heat.' },
  { name: 'Frost Mantle', type: 'armor', baseStat: 'intel', description: 'Icy ward that chills attackers.' },
  { name: 'Echo Shroud', type: 'armor', baseStat: 'vit', description: 'Woven from echoes of the past.' }
];

const ACCESSORY_TEMPLATES = [
  { name: 'Iron Ring', type: 'accessory', baseStat: 'str', description: 'A simple band of power.' },
  { name: 'Mystic Amulet', type: 'accessory', baseStat: 'intel', description: 'Pulses with arcane light.' },
  { name: 'Swift Boots', type: 'accessory', baseStat: 'dex', description: 'Lighter than air.' },
  { name: 'Vitality Pendant', type: 'accessory', baseStat: 'vit', description: 'Thrums with life force.' },
  { name: 'Echo Charm', type: 'accessory', baseStat: 'intel', description: 'Whispers forgotten secrets.' }
];

const CONSUMABLE_TEMPLATES = [
  { name: 'Health Potion', type: 'consumable', effect: { type: 'heal_hp', amount: 25 }, description: 'Restores 25 HP.' },
  { name: 'Mana Elixir', type: 'consumable', effect: { type: 'heal_sp', amount: 20 }, description: 'Restores 20 SP.' },
  { name: 'Greater Health Potion', type: 'consumable', effect: { type: 'heal_hp', amount: 50 }, description: 'Restores 50 HP.' },
  { name: 'Antidote', type: 'consumable', effect: { type: 'cure_dot' }, description: 'Removes all poison and burn effects.' },
  { name: 'Power Draught', type: 'consumable', effect: { type: 'buff_str', amount: 5, duration: 3 }, description: 'Boosts STR by 5 for 3 turns.' }
];

function rollRarity(floorBonus = 0) {
  const adjustedWeights = RARITY_WEIGHTS.map(r => ({
    ...r,
    weight: r.rarity === 'common' ? Math.max(20, r.weight - floorBonus * 5) : r.weight + floorBonus
  }));
  const total = adjustedWeights.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * total;
  for (const r of adjustedWeights) {
    roll -= r.weight;
    if (roll <= 0) return r;
  }
  return adjustedWeights[0];
}

function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateItem(floor = 1, forceType = null) {
  const rarityInfo = rollRarity(floor);
  const [minStat, maxStat] = rarityInfo.statRange;

  let templates;
  const typeRoll = forceType || (['weapon', 'armor', 'accessory', 'consumable'])[Math.floor(Math.random() * 4)];

  switch (typeRoll) {
    case 'weapon': templates = WEAPON_TEMPLATES; break;
    case 'armor': templates = ARMOR_TEMPLATES; break;
    case 'accessory': templates = ACCESSORY_TEMPLATES; break;
    case 'consumable': {
      const tmpl = CONSUMABLE_TEMPLATES[Math.floor(Math.random() * CONSUMABLE_TEMPLATES.length)];
      return {
        item_id: uuidv4(), name: tmpl.name, type: 'consumable', rarity: 'common',
        stats: JSON.stringify(tmpl.effect), description: tmpl.description, is_equipped: 0, quantity: randomInRange(1, 3)
      };
    }
    default: templates = WEAPON_TEMPLATES;
  }

  const tmpl = templates[Math.floor(Math.random() * templates.length)];
  const stats = {};
  stats[tmpl.baseStat] = randomInRange(minStat, maxStat);
  // Secondary stat bonus for rare+
  if (['rare', 'epic', 'legendary'].includes(rarityInfo.rarity)) {
    const secondaryStats = ['str', 'intel', 'dex', 'vit'].filter(s => s !== tmpl.baseStat);
    const sec = secondaryStats[Math.floor(Math.random() * secondaryStats.length)];
    stats[sec] = randomInRange(1, Math.floor(maxStat / 2));
  }

  const prefixes = { uncommon: 'Fine', rare: 'Superior', epic: 'Mythic', legendary: 'Legendary' };
  const name = prefixes[rarityInfo.rarity] ? `${prefixes[rarityInfo.rarity]} ${tmpl.name}` : tmpl.name;

  return {
    item_id: uuidv4(), name, type: tmpl.type, rarity: rarityInfo.rarity,
    stats: JSON.stringify(stats), description: tmpl.description, is_equipped: 0, quantity: 1
  };
}

function generateTreasureLoot(floor = 1, count = 2) {
  const items = [];
  const gold = randomInRange(5 + floor * 3, 15 + floor * 8);
  for (let i = 0; i < count; i++) {
    items.push(generateItem(floor));
  }
  return { items, gold };
}

function generateCombatLoot(floor = 1, enemyId = '') {
  // 60% chance of item drop
  const items = [];
  if (Math.random() < 0.6) {
    items.push(generateItem(floor));
  }
  // 30% chance of consumable
  if (Math.random() < 0.3) {
    items.push(generateItem(floor, 'consumable'));
  }
  return items;
}

function getStartingGear(characterClass) {
  const gear = [];
  switch (characterClass) {
    case 'warrior':
      gear.push({ item_id: uuidv4(), name: 'Recruit Sword', type: 'weapon', rarity: 'common', stats: JSON.stringify({ str: 2 }), description: 'A standard-issue blade.', is_equipped: 1, quantity: 1 });
      gear.push({ item_id: uuidv4(), name: 'Recruit Shield', type: 'armor', rarity: 'common', stats: JSON.stringify({ vit: 2 }), description: 'A wooden shield with iron bands.', is_equipped: 1, quantity: 1 });
      break;
    case 'mage':
      gear.push({ item_id: uuidv4(), name: 'Apprentice Staff', type: 'weapon', rarity: 'common', stats: JSON.stringify({ intel: 2 }), description: 'A gnarled staff of yew.', is_equipped: 1, quantity: 1 });
      gear.push({ item_id: uuidv4(), name: 'Apprentice Robes', type: 'armor', rarity: 'common', stats: JSON.stringify({ intel: 1, vit: 1 }), description: 'Simple enchanted cloth.', is_equipped: 1, quantity: 1 });
      break;
    case 'ranger':
      gear.push({ item_id: uuidv4(), name: 'Scout Bow', type: 'weapon', rarity: 'common', stats: JSON.stringify({ dex: 2 }), description: 'A short composite bow.', is_equipped: 1, quantity: 1 });
      gear.push({ item_id: uuidv4(), name: 'Scout Leather', type: 'armor', rarity: 'common', stats: JSON.stringify({ dex: 1, vit: 1 }), description: 'Supple leather armor.', is_equipped: 1, quantity: 1 });
      break;
  }
  gear.push({ item_id: uuidv4(), name: 'Health Potion', type: 'consumable', rarity: 'common', stats: JSON.stringify({ type: 'heal_hp', amount: 25 }), description: 'Restores 25 HP.', is_equipped: 0, quantity: 3 });
  return gear;
}

module.exports = { generateItem, generateTreasureLoot, generateCombatLoot, getStartingGear, rollRarity };
