const express = require('express');
const { getDb } = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/inventory/:charId - Get full inventory
router.get('/:charId', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const char = db.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(req.params.charId, req.user.id);
    if (!char) return res.status(404).json({ error: 'Character not found.' });

    let items = db.prepare('SELECT * FROM inventory WHERE character_id = ?').all(char.id);

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
router.post('/equip', authMiddleware, (req, res) => {
  try {
    const { characterId, itemId } = req.body;
    const db = getDb();
    const char = db.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(characterId, req.user.id);
    if (!char) return res.status(404).json({ error: 'Character not found.' });

    const item = db.prepare('SELECT * FROM inventory WHERE id = ? AND character_id = ?').get(itemId, characterId);
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    if (item.type === 'consumable') return res.status(400).json({ error: 'Cannot equip consumables.' });

    // Unequip current item of same type
    db.prepare('UPDATE inventory SET is_equipped = 0 WHERE character_id = ? AND type = ? AND is_equipped = 1').run(characterId, item.type);
    // Equip new item
    db.prepare('UPDATE inventory SET is_equipped = 1 WHERE id = ?').run(itemId);

    const inventory = db.prepare('SELECT * FROM inventory WHERE character_id = ?').all(characterId);
    res.json({ message: `Equipped ${item.name}!`, inventory });
  } catch (err) {
    console.error('Equip error:', err);
    res.status(500).json({ error: 'Server error equipping item.' });
  }
});

// POST /api/inventory/unequip
router.post('/unequip', authMiddleware, (req, res) => {
  try {
    const { characterId, itemId } = req.body;
    const db = getDb();
    const item = db.prepare('SELECT * FROM inventory WHERE id = ? AND character_id = ?').get(itemId, characterId);
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    db.prepare('UPDATE inventory SET is_equipped = 0 WHERE id = ?').run(itemId);
    const inventory = db.prepare('SELECT * FROM inventory WHERE character_id = ?').all(characterId);
    res.json({ message: `Unequipped ${item.name}.`, inventory });
  } catch (err) {
    console.error('Unequip error:', err);
    res.status(500).json({ error: 'Server error unequipping item.' });
  }
});

// POST /api/inventory/use - Use consumable
router.post('/use', authMiddleware, (req, res) => {
  try {
    const { characterId, itemId } = req.body;
    const db = getDb();
    const char = db.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(characterId, req.user.id);
    if (!char) return res.status(404).json({ error: 'Character not found.' });

    const item = db.prepare('SELECT * FROM inventory WHERE id = ? AND character_id = ? AND type = ?').get(itemId, characterId, 'consumable');
    if (!item) return res.status(404).json({ error: 'Consumable not found.' });

    let effect;
    try { effect = JSON.parse(item.stats); } catch (e) { return res.status(400).json({ error: 'Invalid item.' }); }

    let message = '';
    if (effect.type === 'heal_hp') {
      const newHp = Math.min(char.hp + effect.amount, char.max_hp);
      db.prepare('UPDATE characters SET hp = ? WHERE id = ?').run(newHp, characterId);
      message = `Restored ${newHp - char.hp} HP!`;
    } else if (effect.type === 'heal_sp') {
      const newSp = Math.min(char.sp + effect.amount, char.max_sp);
      db.prepare('UPDATE characters SET sp = ? WHERE id = ?').run(newSp, characterId);
      message = `Restored ${newSp - char.sp} SP!`;
    }

    if (item.quantity > 1) {
      db.prepare('UPDATE inventory SET quantity = quantity - 1 WHERE id = ?').run(itemId);
    } else {
      db.prepare('DELETE FROM inventory WHERE id = ?').run(itemId);
    }

    const updatedChar = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    res.json({ message, character: updatedChar });
  } catch (err) {
    console.error('Use item error:', err);
    res.status(500).json({ error: 'Server error using item.' });
  }
});

// DELETE /api/inventory/:itemId - Discard item
router.delete('/:itemId', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const item = db.prepare('SELECT i.*, c.user_id FROM inventory i JOIN characters c ON i.character_id = c.id WHERE i.id = ?').get(req.params.itemId);
    if (!item || item.user_id !== req.user.id) return res.status(404).json({ error: 'Item not found.' });

    db.prepare('DELETE FROM inventory WHERE id = ?').run(req.params.itemId);
    res.json({ message: `Discarded ${item.name}.` });
  } catch (err) {
    console.error('Discard error:', err);
    res.status(500).json({ error: 'Server error discarding item.' });
  }
});

module.exports = router;
