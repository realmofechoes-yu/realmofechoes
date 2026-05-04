const { getOne, getAll, run } = require('../db/database');
const { getFloorTemplate, getRandomEnemy, getEnemy, scaleEnemy, ROOM_TYPES } = require('../game/floor-templates');
const { generateTreasureLoot } = require('../game/loot-generator');
const { getActiveLobbies } = require('./lobby-handlers');

// In-memory game sessions
const activeSessions = new Map();

function registerGameHandlers(io, socket) {

  // Host moves to a room (co-op dungeon navigation)
  socket.on('dungeon:move', async (data, callback) => {
    try {
      const { sessionId, roomIndex } = data;
      const session = activeSessions.get(sessionId);
      if (!session) return callback({ success: false, error: 'No active session.' });

      const lobby = getActiveLobbies().get(session.lobbyId);
      if (!lobby) return callback({ success: false, error: 'Lobby not found.' });
      if (lobby.hostUserId !== socket.user.id) return callback({ success: false, error: 'Only host can navigate.' });

      const floor = getFloorTemplate(session.currentFloor);
      if (roomIndex < 0 || roomIndex >= floor.rooms.length) return callback({ success: false, error: 'Invalid room.' });
      if (roomIndex <= session.currentRoom) return callback({ success: false, error: 'Room already cleared.' });

      const room = floor.rooms[roomIndex];
      const result = { room, events: [], playerUpdates: [] };
      const playerCount = lobby.players.length;

      switch (room.type) {
        case ROOM_TYPES.COMBAT:
        case ROOM_TYPES.BOSS: {
          let enemy;
          if (room.type === ROOM_TYPES.BOSS && room.enemyId) {
            enemy = getEnemy(room.enemyId);
          } else {
            enemy = getRandomEnemy(room.enemyPool);
          }
          enemy = scaleEnemy(enemy, session.currentFloor);
          // Scale for co-op
          enemy.hp = Math.floor(enemy.hp * (1 + 0.5 * (playerCount - 1)));
          enemy.maxHp = enemy.hp;
          enemy.atk = Math.floor(enemy.atk * (1 + 0.15 * (playerCount - 1)));
          enemy.xpReward = Math.floor(enemy.xpReward * (1 + 0.25 * (playerCount - 1)));
          enemy.goldReward = Math.floor(enemy.goldReward * playerCount);
          result.enemy = enemy;
          result.events.push({ type: 'combat_start', message: `A ${enemy.name} appears!` });
          break;
        }
        case ROOM_TYPES.TREASURE: {
          const loot = generateTreasureLoot(session.currentFloor);
          const goldPerPlayer = Math.floor(loot.gold / playerCount);
          for (const p of lobby.players) {
            if (!p.characterId) continue;
            await run('UPDATE characters SET gold = gold + $1, updated_at = NOW() WHERE id = $2', [goldPerPlayer, p.characterId]);
            // Distribute items round-robin
          }
          // Simple: give items to random players
          for (let i = 0; i < loot.items.length; i++) {
            const recipient = lobby.players[i % playerCount];
            if (!recipient.characterId) continue;
            const item = loot.items[i];
            await run('INSERT INTO inventory (character_id,item_id,name,type,rarity,stats,description,is_equipped,quantity) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
              [recipient.characterId, item.item_id, item.name, item.type, item.rarity, item.stats, item.description, false, item.quantity]);
          }
          result.loot = loot;
          result.goldPerPlayer = goldPerPlayer;
          result.events.push({ type: 'treasure', message: `Found ${loot.gold} gold (${goldPerPlayer} each) and ${loot.items.length} items!` });
          break;
        }
        case ROOM_TYPES.SHRINE: {
          const effect = room.shrineEffect;
          for (const p of lobby.players) {
            if (!p.characterId) continue;
            if (effect.type === 'heal') {
              await run('UPDATE characters SET hp = LEAST(hp + $1, max_hp), updated_at = NOW() WHERE id = $2', [effect.amount, p.characterId]);
            } else if (effect.type === 'restore_sp') {
              await run('UPDATE characters SET sp = LEAST(sp + $1, max_sp), updated_at = NOW() WHERE id = $2', [effect.amount, p.characterId]);
            }
          }
          result.events.push({ type: 'shrine', message: `The shrine restores ${effect.amount} ${effect.type === 'heal' ? 'HP' : 'SP'} to all!` });
          break;
        }
        case ROOM_TYPES.TRAP: {
          for (const p of lobby.players) {
            if (!p.characterId) continue;
            await run('UPDATE characters SET hp = GREATEST(1, hp - $1), updated_at = NOW() WHERE id = $2', [room.trapDamage, p.characterId]);
          }
          result.events.push({ type: 'trap', message: `Trap! All party members take ${room.trapDamage} damage!` });
          break;
        }
        case ROOM_TYPES.REST: {
          const hpRestore = room.restoreHp || 15;
          const spRestore = room.restoreSp || 10;
          for (const p of lobby.players) {
            if (!p.characterId) continue;
            await run('UPDATE characters SET hp = LEAST(hp + $1, max_hp), sp = LEAST(sp + $2, max_sp), updated_at = NOW() WHERE id = $3', [hpRestore, spRestore, p.characterId]);
          }
          result.events.push({ type: 'rest', message: `The party rests. Everyone recovers ${hpRestore} HP and ${spRestore} SP.` });
          break;
        }
      }

      session.currentRoom = roomIndex;
      await run('UPDATE coop_sessions SET current_room = $1, updated_at = NOW() WHERE id = $2', [roomIndex, sessionId]);

      // Update all characters' room position
      for (const p of lobby.players) {
        if (!p.characterId) continue;
        await run('UPDATE characters SET current_room = $1, rooms_cleared = rooms_cleared + 1, updated_at = NOW() WHERE id = $2', [roomIndex, p.characterId]);
      }

      // Fetch updated character data for all players
      const updatedChars = [];
      for (const p of lobby.players) {
        if (!p.characterId) continue;
        const c = await getOne('SELECT * FROM characters WHERE id = $1', [p.characterId]);
        updatedChars.push({ userId: p.userId, character: c });
      }
      result.characters = updatedChars;

      io.to(`lobby:${session.lobbyId}`).emit('dungeon:room_entered', result);
      callback({ success: true, result });
    } catch (err) {
      console.error('Dungeon move error:', err);
      callback({ success: false, error: 'Server error moving rooms.' });
    }
  });

  // Next floor
  socket.on('dungeon:next_floor', async (data, callback) => {
    try {
      const { sessionId } = data;
      const session = activeSessions.get(sessionId);
      if (!session) return callback({ success: false, error: 'No active session.' });

      const lobby = getActiveLobbies().get(session.lobbyId);
      if (!lobby) return callback({ success: false, error: 'Lobby not found.' });
      if (lobby.hostUserId !== socket.user.id) return callback({ success: false, error: 'Only host can advance.' });

      const newFloor = session.currentFloor + 1;
      if (newFloor > 5) {
        await run('UPDATE coop_sessions SET status = $1, updated_at = NOW() WHERE id = $2', ['completed', sessionId]);
        for (const p of lobby.players) {
          if (!p.characterId) continue;
          await run('UPDATE characters SET run_status = $1, updated_at = NOW() WHERE id = $2', ['completed', p.characterId]);
          await run('UPDATE users SET total_runs = total_runs + 1, deepest_floor = GREATEST(deepest_floor, $1) WHERE id = $2', [5, p.userId]);
        }
        io.to(`lobby:${session.lobbyId}`).emit('dungeon:completed', { message: 'The dungeon is conquered!' });
        return callback({ success: true, completed: true });
      }

      session.currentFloor = newFloor;
      session.currentRoom = -1;
      await run('UPDATE coop_sessions SET current_floor = $1, current_room = -1, updated_at = NOW() WHERE id = $2', [newFloor, sessionId]);

      for (const p of lobby.players) {
        if (!p.characterId) continue;
        await run('UPDATE characters SET current_floor = $1, current_room = -1, updated_at = NOW() WHERE id = $2', [newFloor, p.characterId]);
      }

      const floor = getFloorTemplate(newFloor);
      io.to(`lobby:${session.lobbyId}`).emit('dungeon:next_floor', { floor, currentFloor: newFloor, currentRoom: -1 });
      callback({ success: true, floor, currentFloor: newFloor });
    } catch (err) {
      console.error('Next floor error:', err);
      callback({ success: false, error: 'Server error advancing floor.' });
    }
  });

  // Host dismisses the event modal
  socket.on('dungeon:dismiss_event', async (data, callback) => {
    try {
      const { sessionId } = data;
      const session = activeSessions.get(sessionId);
      if (!session) return callback({ success: false, error: 'No active session.' });

      const lobby = getActiveLobbies().get(session.lobbyId);
      if (!lobby) return callback({ success: false, error: 'Lobby not found.' });
      if (lobby.hostUserId !== socket.user.id) return callback({ success: false, error: 'Only host can dismiss.' });

      io.to(`lobby:${session.lobbyId}`).emit('dungeon:event_dismissed', {});
      if (callback) callback({ success: true });
    } catch (err) {
      console.error('Dismiss event error:', err);
      if (callback) callback({ success: false, error: 'Server error.' });
    }
  });

  // Sync state (for reconnection)
  socket.on('session:sync', async (data, callback) => {
    try {
      const { sessionId } = data;
      const session = activeSessions.get(sessionId);
      if (!session) return callback({ success: false, error: 'Session not found.' });

      const lobby = getActiveLobbies().get(session.lobbyId);
      const floor = getFloorTemplate(session.currentFloor);
      const chars = [];
      if (lobby) {
        for (const p of lobby.players) {
          if (!p.characterId) continue;
          const c = await getOne('SELECT * FROM characters WHERE id = $1', [p.characterId]);
          chars.push({ userId: p.userId, username: p.username, character: c });
        }
      }

      callback({
        success: true,
        session: { id: session.id, currentFloor: session.currentFloor, currentRoom: session.currentRoom },
        floor, characters: chars, players: lobby?.players || []
      });
    } catch (err) {
      console.error('Session sync error:', err);
      callback({ success: false, error: 'Sync failed.' });
    }
  });
}

function createSession(lobbyId, sessionId) {
  const session = { id: sessionId, lobbyId, currentFloor: 1, currentRoom: -1, status: 'active' };
  activeSessions.set(sessionId, session);
  return session;
}

function getSession(sessionId) {
  return activeSessions.get(sessionId);
}

module.exports = { registerGameHandlers, createSession, getSession, activeSessions };
