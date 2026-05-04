const express = require('express');
const { getOne, getAll, run } = require('../db/database');
const authMiddleware = require('../middleware/auth');
const { getStartingGear } = require('../game/loot-generator');
const { CLASS_SKILLS } = require('../game/combat-engine');

const router = express.Router();

const CLASS_DEFAULTS = {
  warrior: { hp: 120, max_hp: 120, sp: 40, max_sp: 40, str: 8, intel: 3, dex: 4, vit: 7 },
  mage:    { hp: 80,  max_hp: 80,  sp: 80, max_sp: 80, str: 3, intel: 8, dex: 4, vit: 5 },
  ranger:  { hp: 100, max_hp: 100, sp: 60, max_sp: 60, str: 4, intel: 4, dex: 8, vit: 5 }
};

// POST /api/characters - Create new character
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, characterClass } = req.body;
    if (!name || !characterClass) return res.status(400).json({ error: 'Name and class are required.' });
    if (!CLASS_DEFAULTS[characterClass]) return res.status(400).json({ error: 'Invalid class. Choose warrior, mage, or ranger.' });

    const defaults = CLASS_DEFAULTS[characterClass];
    const result = await getOne(
      `INSERT INTO characters (user_id, name, class, hp, max_hp, sp, max_sp, str, intel, dex, vit, current_room) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, -1) RETURNING id`,
      [req.user.id, name, characterClass, defaults.hp, defaults.max_hp, defaults.sp, defaults.max_sp, defaults.str, defaults.intel, defaults.dex, defaults.vit]
    );

    const charId = result.id;
    const startingGear = getStartingGear(characterClass);
    for (const item of startingGear) {
      await run(
        'INSERT INTO inventory (character_id, item_id, name, type, rarity, stats, description, is_equipped, quantity) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [charId, item.item_id, item.name, item.type, item.rarity, item.stats, item.description, item.is_equipped, item.quantity]
      );
    }

    const character = await getOne('SELECT * FROM characters WHERE id = $1', [charId]);
    const inventory = await getAll('SELECT * FROM inventory WHERE character_id = $1', [charId]);
    const skills = CLASS_SKILLS[characterClass];

    res.status(201).json({ character, inventory, skills });
  } catch (err) {
    console.error('Create character error:', err);
    res.status(500).json({ error: 'Server error creating character.' });
  }
});

// GET /api/characters - List all characters for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const characters = await getAll('SELECT * FROM characters WHERE user_id = $1 ORDER BY updated_at DESC', [req.user.id]);
    res.json(characters);
  } catch (err) {
    console.error('List characters error:', err);
    res.status(500).json({ error: 'Server error listing characters.' });
  }
});

// GET /api/characters/:id - Get single character with inventory
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const character = await getOne('SELECT * FROM characters WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!character) return res.status(404).json({ error: 'Character not found.' });

    const inventory = await getAll('SELECT * FROM inventory WHERE character_id = $1', [character.id]);
    const combatLogs = await getAll('SELECT * FROM combat_logs WHERE character_id = $1 ORDER BY created_at DESC LIMIT 20', [character.id]);
    const skills = CLASS_SKILLS[character.class];

    res.json({ character, inventory, combatLogs, skills });
  } catch (err) {
    console.error('Get character error:', err);
    res.status(500).json({ error: 'Server error fetching character.' });
  }
});

// PUT /api/characters/:id - Update character (stat allocation)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const character = await getOne('SELECT * FROM characters WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!character) return res.status(404).json({ error: 'Character not found.' });

    const { str, intel, dex, vit } = req.body;
    const totalSpent = (str || 0) + (intel || 0) + (dex || 0) + (vit || 0);
    if (totalSpent > character.stat_points) return res.status(400).json({ error: 'Not enough stat points.' });

    const newStr = character.str + (str || 0);
    const newIntel = character.intel + (intel || 0);
    const newDex = character.dex + (dex || 0);
    const newVit = character.vit + (vit || 0);
    const newMaxHp = character.max_hp + (vit || 0) * 5;
    const newMaxSp = character.max_sp + (intel || 0) * 3;

    await run(
      `UPDATE characters SET str = $1, intel = $2, dex = $3, vit = $4, max_hp = $5, max_sp = $6, hp = LEAST(hp, $5), sp = LEAST(sp, $6), stat_points = stat_points - $7, updated_at = NOW() WHERE id = $8`,
      [newStr, newIntel, newDex, newVit, newMaxHp, newMaxSp, totalSpent, character.id]
    );

    const updated = await getOne('SELECT * FROM characters WHERE id = $1', [character.id]);
    res.json(updated);
  } catch (err) {
    console.error('Update character error:', err);
    res.status(500).json({ error: 'Server error updating character.' });
  }
});

// DELETE /api/characters/:id - Delete character
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const character = await getOne('SELECT * FROM characters WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!character) return res.status(404).json({ error: 'Character not found.' });
    
    // Clear references in other tables first to avoid foreign key constraint errors
    await run('UPDATE lobby_members SET character_id = NULL WHERE character_id = $1', [character.id]);
    await run('DELETE FROM combat_logs WHERE character_id = $1', [character.id]);
    await run('DELETE FROM inventory WHERE character_id = $1', [character.id]);
    await run('DELETE FROM characters WHERE id = $1', [character.id]);

    res.json({ message: 'Character deleted successfully.' });
  } catch (err) {
    console.error('Delete character error:', err);
    res.status(500).json({ error: 'Server error deleting character.' });
  }
});

module.exports = router;
