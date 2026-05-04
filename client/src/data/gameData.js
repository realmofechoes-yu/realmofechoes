export const CLASS_INFO = {
  warrior: {
    name: 'Warrior',
    icon: '⚔️',
    color: 'var(--ember)',
    colorBright: 'var(--ember-bright)',
    description: 'A stalwart defender with unmatched endurance. Masters of melee combat who shrug off blows that would fell lesser fighters.',
    stats: { hp: 120, sp: 40, str: 8, intel: 3, dex: 4, vit: 7 },
    skills: [
      { key: 'skill1', name: 'Cleave', description: '1.5× STR damage', cost: '15 SP', spCost: 15, icon: '🗡️' },
      { key: 'skill2', name: 'Shield Bash', description: 'Stun enemy for 1 turn', cost: '20 SP', spCost: 20, icon: '🛡️' }
    ],
    passive: { name: 'Iron Skin', description: '+10% DEF', icon: '🔰' }
  },
  mage: {
    name: 'Mage',
    icon: '🔮',
    color: 'var(--arcane)',
    colorBright: 'var(--arcane-bright)',
    description: 'A wielder of arcane forces, bending the elements to their will. Devastating at range but fragile up close.',
    stats: { hp: 80, sp: 80, str: 3, intel: 8, dex: 4, vit: 5 },
    skills: [
      { key: 'skill1', name: 'Fireball', description: '2× INT damage', cost: '20 SP', spCost: 20, icon: '🔥' },
      { key: 'skill2', name: 'Frost Nova', description: 'AoE damage + slow', cost: '25 SP', spCost: 25, icon: '❄️' }
    ],
    passive: { name: 'Arcane Focus', description: '+15% spell damage', icon: '✨' }
  },
  ranger: {
    name: 'Ranger',
    icon: '🏹',
    color: 'var(--nature)',
    colorBright: 'var(--nature-bright)',
    description: 'A swift hunter who strikes from the shadows. High critical chance and evasion make them deadly unpredictable.',
    stats: { hp: 100, sp: 60, str: 4, intel: 4, dex: 8, vit: 5 },
    skills: [
      { key: 'skill1', name: 'Power Shot', description: '1.8× DEX damage', cost: '12 SP', spCost: 12, icon: '🎯' },
      { key: 'skill2', name: 'Smoke Bomb', description: 'Dodge next attack', cost: '18 SP', spCost: 18, icon: '💨' }
    ],
    passive: { name: 'Eagle Eye', description: '+10% crit chance', icon: '🦅' }
  }
};

export const ROOM_ICONS = {
  combat: '⚔️',
  treasure: '💰',
  shrine: '🏛️',
  trap: '🪤',
  boss: '👹',
  rest: '🏕️'
};

export const ROOM_LABELS = {
  combat: 'Combat',
  treasure: 'Treasure',
  shrine: 'Shrine',
  trap: 'Trap',
  boss: 'Boss',
  rest: 'Rest'
};

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const RARITY_LABELS = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };

export const STAT_LABELS = { str: 'STR', intel: 'INT', dex: 'DEX', vit: 'VIT' };
export const STAT_DESCRIPTIONS = {
  str: 'Strength — Increases physical damage',
  intel: 'Intelligence — Increases spell power and max SP',
  dex: 'Dexterity — Increases crit chance and dodge',
  vit: 'Vitality — Increases max HP and defense'
};
