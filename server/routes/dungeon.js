const express = require('express');
const { getOne, getAll, run } = require('../db/database');
const authMiddleware = require('../middleware/auth');
const { getFloorTemplate, getRandomEnemy, getEnemy, scaleEnemy, ROOM_TYPES } = require('../game/floor-templates');
const { generateTreasureLoot } = require('../game/loot-generator');

const router = express.Router();

// POST /api/dungeon/enter
router.post('/enter', authMiddleware, async (req, res) => {
  try {
    const { characterId } = req.body;
    const char = await getOne('SELECT * FROM characters WHERE id = $1 AND user_id = $2', [characterId, req.user.id]);
    if (!char) return res.status(404).json({ error: 'Character not found.' });
    if (!char.is_alive) return res.status(400).json({ error: 'Character is dead. Start a new run.' });
    const floor = getFloorTemplate(char.current_floor);
    res.json({ floor, currentRoom: char.current_room, character: char });
  } catch (err) {
    console.error('Enter dungeon error:', err);
    res.status(500).json({ error: 'Server error entering dungeon.' });
  }
});

// GET /api/dungeon/:charId/floor
router.get('/:charId/floor', authMiddleware, async (req, res) => {
  try {
    const char = await getOne('SELECT * FROM characters WHERE id = $1 AND user_id = $2', [req.params.charId, req.user.id]);
    if (!char) return res.status(404).json({ error: 'Character not found.' });
    const floor = getFloorTemplate(char.current_floor);
    res.json({ floor, currentRoom: char.current_room, character: char });
  } catch (err) {
    console.error('Get floor error:', err);
    res.status(500).json({ error: 'Server error fetching floor.' });
  }
});

// POST /api/dungeon/move
router.post('/move', authMiddleware, async (req, res) => {
  try {
    const { characterId, roomIndex } = req.body;
    const char = await getOne('SELECT * FROM characters WHERE id = $1 AND user_id = $2', [characterId, req.user.id]);
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
        for (const item of loot.items) {
          await run('INSERT INTO inventory (character_id, item_id, name, type, rarity, stats, description, is_equipped, quantity) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
            [char.id, item.item_id, item.name, item.type, item.rarity, item.stats, item.description, false, item.quantity]);
        }
        await run('UPDATE characters SET gold = gold + $1, updated_at = NOW() WHERE id = $2', [loot.gold, char.id]);
        result.loot = loot;
        result.events.push({ type: 'treasure', message: `Found ${loot.gold} gold and ${loot.items.length} items!` });
        break;
      }
      case ROOM_TYPES.SHRINE: {
        const effect = room.shrineEffect;
        if (effect.type === 'heal') {
          const newHp = Math.min(char.hp + effect.amount, char.max_hp);
          await run('UPDATE characters SET hp = $1, updated_at = NOW() WHERE id = $2', [newHp, char.id]);
          result.events.push({ type: 'shrine', message: `The shrine restores ${effect.amount} HP!` });
        } else if (effect.type === 'restore_sp') {
          const newSp = Math.min(char.sp + effect.amount, char.max_sp);
          await run('UPDATE characters SET sp = $1, updated_at = NOW() WHERE id = $2', [newSp, char.id]);
          result.events.push({ type: 'shrine', message: `The shrine restores ${effect.amount} SP!` });
        }
        break;
      }
      case ROOM_TYPES.TRAP: {
        const newHp = Math.max(1, char.hp - room.trapDamage);
        await run('UPDATE characters SET hp = $1, updated_at = NOW() WHERE id = $2', [newHp, char.id]);
        result.events.push({ type: 'trap', message: `You triggered a trap! Took ${room.trapDamage} damage.` });
        result.newHp = newHp;
        break;
      }
      case ROOM_TYPES.REST: {
        const newHp = Math.min(char.hp + (room.restoreHp || 15), char.max_hp);
        const newSp = Math.min(char.sp + (room.restoreSp || 10), char.max_sp);
        await run('UPDATE characters SET hp = $1, sp = $2, updated_at = NOW() WHERE id = $3', [newHp, newSp, char.id]);
        result.events.push({ type: 'rest', message: `You rest and recover ${room.restoreHp || 15} HP and ${room.restoreSp || 10} SP.` });
        break;
      }
    }

    // Only update room progress if it's not a combat/boss room. 
    // Combat rooms will update the current_room state ONLY upon victory.
    if (room.type !== 'combat' && room.type !== 'boss') {
      await run('UPDATE characters SET current_room = $1, rooms_cleared = rooms_cleared + 1, updated_at = NOW() WHERE id = $2', [roomIndex, char.id]);
    }
    
    result.character = await getOne('SELECT * FROM characters WHERE id = $1', [char.id]);
    res.json(result);
  } catch (err) {
    console.error('Move error:', err);
    res.status(500).json({ error: 'Server error moving rooms.' });
  }
});

// POST /api/dungeon/next-floor
router.post('/next-floor', authMiddleware, async (req, res) => {
  try {
    const { characterId } = req.body;
    const char = await getOne('SELECT * FROM characters WHERE id = $1 AND user_id = $2', [characterId, req.user.id]);
    if (!char) return res.status(404).json({ error: 'Character not found.' });
    const newFloor = char.current_floor + 1;
    if (newFloor > 5) {
      await run('UPDATE characters SET run_status = $1, updated_at = NOW() WHERE id = $2', ['completed', char.id]);
      await run('UPDATE users SET total_runs = total_runs + 1, deepest_floor = GREATEST(deepest_floor, $1), total_gold = total_gold + $2 WHERE id = $3', [char.current_floor, char.gold, req.user.id]);
      return res.json({ completed: true, message: 'Congratulations! You have conquered the dungeon!' });
    }
    await run('UPDATE characters SET current_floor = $1, current_room = -1, updated_at = NOW() WHERE id = $2', [newFloor, char.id]);
    await run('UPDATE users SET deepest_floor = GREATEST(deepest_floor, $1) WHERE id = $2', [newFloor, req.user.id]);
    const floor = getFloorTemplate(newFloor);
    res.json({ floor, currentRoom: 0, currentFloor: newFloor });
  } catch (err) {
    console.error('Next floor error:', err);
    res.status(500).json({ error: 'Server error advancing floor.' });
  }
});

// POST /api/dungeon/save
router.post('/save', authMiddleware, async (req, res) => {
  try {
    const { characterId } = req.body;
    const char = await getOne('SELECT * FROM characters WHERE id = $1 AND user_id = $2', [characterId, req.user.id]);
    if (!char) return res.status(404).json({ error: 'Character not found.' });
    await run('UPDATE characters SET updated_at = NOW() WHERE id = $1', [char.id]);
    res.json({ message: 'Checkpoint saved!', character: char });
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ error: 'Server error saving checkpoint.' });
  }
});

module.exports = router;
