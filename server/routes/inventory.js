const express = require('express');
const { getOne, getAll, run } = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/inventory/:charId - Get full inventory
router.get('/:charId', authMiddleware, async (req, res) => {
  try {
    const char = await getOne('SELECT * FROM characters WHERE id = $1 AND user_id = $2', [req.params.charId, req.user.id]);
    if (!char) return res.status(404).json({ error: 'Character not found.' });

    let items = await getAll('SELECT * FROM inventory WHERE character_id = $1', [char.id]);

    // Apply filters
    const { type, rarity, sort } = req.query;
    if (type) items = items.filter(i => i.type === type);
    if (rarity) items = items.filter(i => i.rarity === rarity);

    // Sort
    if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'rarity') {
      const order = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
      items.sort((a, b) => (order[a.rarity] || 5) - (order[b.rarity] || 5));
    }
    else if (sort === 'type') items.sort((a, b) => a.type.localeCompare(b.type));

    res.json({ items, equipped: items.filter(i => i.is_equipped), backpack: items.filter(i => !i.is_equipped) });
  } catch (err) {
    console.error('Inventory error:', err);
    res.status(500).json({ error: 'Server error fetching inventory.' });
  }
});

// POST /api/inventory/equip
router.post('/equip', authMiddleware, async (req, res) => {
  try {
    const { characterId, itemId } = req.body;
    const char = await getOne('SELECT * FROM characters WHERE id = $1 AND user_id = $2', [characterId, req.user.id]);
    if (!char) return res.status(404).json({ error: 'Character not found.' });

    const item = await getOne('SELECT * FROM inventory WHERE id = $1 AND character_id = $2', [itemId, characterId]);
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    if (item.type === 'consumable') return res.status(400).json({ error: 'Cannot equip consumables.' });

    // Unequip current item of same type
    await run('UPDATE inventory SET is_equipped = FALSE WHERE character_id = $1 AND type = $2 AND is_equipped = TRUE', [characterId, item.type]);
    // Equip new item
    await run('UPDATE inventory SET is_equipped = TRUE WHERE id = $1', [itemId]);

    const inventory = await getAll('SELECT * FROM inventory WHERE character_id = $1', [characterId]);
    res.json({ message: `Equipped ${item.name}!`, inventory });
  } catch (err) {
    console.error('Equip error:', err);
    res.status(500).json({ error: 'Server error equipping item.' });
  }
});

// POST /api/inventory/unequip
router.post('/unequip', authMiddleware, async (req, res) => {
  try {
    const { characterId, itemId } = req.body;
    const item = await getOne('SELECT * FROM inventory WHERE id = $1 AND character_id = $2', [itemId, characterId]);
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    await run('UPDATE inventory SET is_equipped = FALSE WHERE id = $1', [itemId]);
    const inventory = await getAll('SELECT * FROM inventory WHERE character_id = $1', [characterId]);
    res.json({ message: `Unequipped ${item.name}.`, inventory });
  } catch (err) {
    console.error('Unequip error:', err);
    res.status(500).json({ error: 'Server error unequipping item.' });
  }
});

// POST /api/inventory/use - Use consumable
router.post('/use', authMiddleware, async (req, res) => {
  try {
    const { characterId, itemId } = req.body;
    const char = await getOne('SELECT * FROM characters WHERE id = $1 AND user_id = $2', [characterId, req.user.id]);
    if (!char) return res.status(404).json({ error: 'Character not found.' });

    const item = await getOne('SELECT * FROM inventory WHERE id = $1 AND character_id = $2 AND type = $3', [itemId, characterId, 'consumable']);
    if (!item) return res.status(404).json({ error: 'Consumable not found.' });

    let effect;
    try { effect = JSON.parse(item.stats); } catch (e) { return res.status(400).json({ error: 'Invalid item.' }); }

    let message = '';
    if (effect.type === 'heal_hp') {
      const newHp = Math.min(char.hp + effect.amount, char.max_hp);
      await run('UPDATE characters SET hp = $1 WHERE id = $2', [newHp, characterId]);
      message = `Restored ${newHp - char.hp} HP!`;
    } else if (effect.type === 'heal_sp') {
      const newSp = Math.min(char.sp + effect.amount, char.max_sp);
      await run('UPDATE characters SET sp = $1 WHERE id = $2', [newSp, characterId]);
      message = `Restored ${newSp - char.sp} SP!`;
    }

    if (item.quantity > 1) {
      await run('UPDATE inventory SET quantity = quantity - 1 WHERE id = $1', [itemId]);
    } else {
      await run('DELETE FROM inventory WHERE id = $1', [itemId]);
    }

    const updatedChar = await getOne('SELECT * FROM characters WHERE id = $1', [characterId]);
    res.json({ message, character: updatedChar });
  } catch (err) {
    console.error('Use item error:', err);
    res.status(500).json({ error: 'Server error using item.' });
  }
});

// DELETE /api/inventory/:itemId - Discard item
router.delete('/:itemId', authMiddleware, async (req, res) => {
  try {
    const item = await getOne('SELECT i.*, c.user_id FROM inventory i JOIN characters c ON i.character_id = c.id WHERE i.id = $1', [req.params.itemId]);
    if (!item || item.user_id !== req.user.id) return res.status(404).json({ error: 'Item not found.' });

    await run('DELETE FROM inventory WHERE id = $1', [req.params.itemId]);
    res.json({ message: `Discarded ${item.name}.` });
  } catch (err) {
    console.error('Discard error:', err);
    res.status(500).json({ error: 'Server error discarding item.' });
  }
});

module.exports = router;
