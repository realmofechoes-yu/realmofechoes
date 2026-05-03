const express = require('express');
const { getDb } = require('../db/database');
const authMiddleware = require('../middleware/auth');
const { getFloorTemplate, getRandomEnemy, getEnemy, scaleEnemy, ROOM_TYPES } = require('../game/floor-templates');
const { generateTreasureLoot } = require('../game/loot-generator');

const router = express.Router();

// POST /api/dungeon/enter - Enter dungeon / start floor
router.post('/enter', authMiddleware, (req, res) => {
  try {
    const { characterId } = req.body;
    const db = getDb();
    const char = db.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(characterId, req.user.id);
    if (!char) return res.status(404).json({ error: 'Character not found.' });
    if (!char.is_alive) return res.status(400).json({ error: 'Character is dead. Start a new run.' });

    const floor = getFloorTemplate(char.current_floor);
    // Removed unconditional reset to 0 to prevent progress loss on page refresh/combat return
    
    res.json({ floor, currentRoom: char.current_room, character: char });
  } catch (err) {
    console.error('Enter dungeon error:', err);
    res.status(500).json({ error: 'Server error entering dungeon.' });
  }
});

// GET /api/dungeon/:charId/floor - Get current floor layout
router.get('/:charId/floor', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const char = db.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(req.params.charId, req.user.id);
    if (!char) return res.status(404).json({ error: 'Character not found.' });

    const floor = getFloorTemplate(char.current_floor);
    res.json({ floor, currentRoom: char.current_room, character: char });
  } catch (err) {
    console.error('Get floor error:', err);
    res.status(500).json({ error: 'Server error fetching floor.' });
  }
});

// POST /api/dungeon/move - Move to next room and resolve event
router.post('/move', authMiddleware, (req, res) => {
  try {
    const { characterId, roomIndex } = req.body;
    const db = getDb();
    const char = db.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(characterId, req.user.id);
    if (!char) return res.status(404).json({ error: 'Character not found.' });
    if (!char.is_alive) return res.status(400).json({ error: 'Character is dead.' });
    if (roomIndex <= char.current_room) return res.status(400).json({ error: 'Room already cleared.' });

    const floor = getFloorTemplate(char.current_floor);
    if (roomIndex < 0 || roomIndex >= floor.rooms.length) {
      return res.status(400).json({ error: 'Invalid room index.' });
    }

    const room = floor.rooms[roomIndex];
    const result = { room, events: [] };

    switch (room.type) {
      case ROOM_TYPES.COMBAT:
      case ROOM_TYPES.BOSS: {
        let enemy;
        if (room.type === ROOM_TYPES.BOSS && room.enemyId) {
          enemy = getEnemy(room.enemyId);
        } else {
          enemy = getRandomEnemy(room.enemyPool);
        }
        enemy = scaleEnemy(enemy, char.current_floor);
        result.enemy = enemy;
        result.events.push({ type: 'combat_start', message: `A ${enemy.name} appears!` });
        break;
      }
      case ROOM_TYPES.TREASURE: {
        const loot = generateTreasureLoot(char.current_floor);
        const insertItem = db.prepare('INSERT INTO inventory (character_id, item_id, name, type, rarity, stats, description, is_equipped, quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const item of loot.items) {
          insertItem.run(char.id, item.item_id, item.name, item.type, item.rarity, item.stats, item.description, 0, item.quantity);
        }
        db.prepare('UPDATE characters SET gold = gold + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(loot.gold, char.id);
        result.loot = loot;
        result.events.push({ type: 'treasure', message: `Found ${loot.gold} gold and ${loot.items.length} items!` });
        break;
      }
      case ROOM_TYPES.SHRINE: {
        const effect = room.shrineEffect;
        if (effect.type === 'heal') {
          const newHp = Math.min(char.hp + effect.amount, char.max_hp);
          db.prepare('UPDATE characters SET hp = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHp, char.id);
          result.events.push({ type: 'shrine', message: `The shrine restores ${effect.amount} HP!` });
        } else if (effect.type === 'restore_sp') {
          const newSp = Math.min(char.sp + effect.amount, char.max_sp);
          db.prepare('UPDATE characters SET sp = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newSp, char.id);
          result.events.push({ type: 'shrine', message: `The shrine restores ${effect.amount} SP!` });
        }
        break;
      }
      case ROOM_TYPES.TRAP: {
        const newHp = Math.max(1, char.hp - room.trapDamage);
        db.prepare('UPDATE characters SET hp = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHp, char.id);
        result.events.push({ type: 'trap', message: `You triggered a trap! Took ${room.trapDamage} damage.` });
        result.newHp = newHp;
        break;
      }
      case ROOM_TYPES.REST: {
        const newHp = Math.min(char.hp + (room.restoreHp || 15), char.max_hp);
        const newSp = Math.min(char.sp + (room.restoreSp || 10), char.max_sp);
        db.prepare('UPDATE characters SET hp = ?, sp = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHp, newSp, char.id);
        result.events.push({ type: 'rest', message: `You rest and recover ${room.restoreHp || 15} HP and ${room.restoreSp || 10} SP.` });
        break;
      }
    }

    db.prepare('UPDATE characters SET current_room = ?, rooms_cleared = rooms_cleared + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(roomIndex, char.id);
    result.character = db.prepare('SELECT * FROM characters WHERE id = ?').get(char.id);

    res.json(result);
  } catch (err) {
    console.error('Move error:', err);
    res.status(500).json({ error: 'Server error moving rooms.' });
  }
});

// POST /api/dungeon/next-floor - Advance to next floor
router.post('/next-floor', authMiddleware, (req, res) => {
  try {
    const { characterId } = req.body;
    const db = getDb();
    const char = db.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(characterId, req.user.id);
    if (!char) return res.status(404).json({ error: 'Character not found.' });

    const newFloor = char.current_floor + 1;
    if (newFloor > 5) {
      // Completed all floors!
      db.prepare('UPDATE characters SET run_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('completed', char.id);
      db.prepare('UPDATE users SET total_runs = total_runs + 1, deepest_floor = MAX(deepest_floor, ?), total_gold = total_gold + ? WHERE id = ?').run(char.current_floor, char.gold, req.user.id);
      return res.json({ completed: true, message: 'Congratulations! You have conquered the dungeon!' });
    }

    db.prepare('UPDATE characters SET current_floor = ?, current_room = -1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newFloor, char.id);
    db.prepare('UPDATE users SET deepest_floor = MAX(deepest_floor, ?) WHERE id = ?').run(newFloor, req.user.id);

    const floor = getFloorTemplate(newFloor);
    res.json({ floor, currentRoom: 0, currentFloor: newFloor });
  } catch (err) {
    console.error('Next floor error:', err);
    res.status(500).json({ error: 'Server error advancing floor.' });
  }
});

// POST /api/dungeon/save - Save checkpoint
router.post('/save', authMiddleware, (req, res) => {
  try {
    const { characterId } = req.body;
    const db = getDb();
    const char = db.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(characterId, req.user.id);
    if (!char) return res.status(404).json({ error: 'Character not found.' });

    db.prepare('UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(char.id);
    res.json({ message: 'Checkpoint saved!', character: char });
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ error: 'Server error saving checkpoint.' });
  }
});

module.exports = router;
