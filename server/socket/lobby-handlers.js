const { getOne, getAll, run } = require('../db/database');

// In-memory lobby states
const activeLobbies = new Map();

function generateLobbyCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function registerLobbyHandlers(io, socket) {

  // Create a new lobby
  socket.on('lobby:create', async (data, callback) => {
    try {
      const { lobbyName } = data;
      const name = lobbyName || `${socket.user.username}'s Lobby`;
      let code;
      let attempts = 0;
      do {
        code = generateLobbyCode();
        const existing = await getOne('SELECT id FROM lobbies WHERE code = $1', [code]);
        if (!existing) break;
        attempts++;
      } while (attempts < 10);

      const lobby = await getOne(
        'INSERT INTO lobbies (code, host_user_id, name) VALUES ($1, $2, $3) RETURNING *',
        [code, socket.user.id, name]
      );

      await run(
        'INSERT INTO lobby_members (lobby_id, user_id, slot_index) VALUES ($1, $2, $3)',
        [lobby.id, socket.user.id, 0]
      );

      const lobbyState = {
        id: lobby.id,
        code: lobby.code,
        name: lobby.name,
        hostUserId: socket.user.id,
        maxPlayers: 4,
        status: 'waiting',
        players: [{
          userId: socket.user.id,
          username: socket.user.username,
          characterId: null,
          characterName: null,
          characterClass: null,
          characterLevel: null,
          isReady: false,
          slotIndex: 0
        }]
      };

      activeLobbies.set(lobby.id, lobbyState);
      socket.join(`lobby:${lobby.id}`);
      socket.lobbyId = lobby.id;

      callback({ success: true, lobby: lobbyState });
    } catch (err) {
      console.error('Lobby create error:', err);
      callback({ success: false, error: 'Failed to create lobby.' });
    }
  });

  // Join an existing lobby
  socket.on('lobby:join', async (data, callback) => {
    try {
      const { code } = data;
      const lobby = await getOne('SELECT * FROM lobbies WHERE code = $1 AND status = $2', [code.toUpperCase(), 'waiting']);
      if (!lobby) return callback({ success: false, error: 'Lobby not found or already started.' });

      let lobbyState = activeLobbies.get(lobby.id);
      if (!lobbyState) {
        // Rebuild from DB
        const members = await getAll('SELECT lm.*, u.username FROM lobby_members lm JOIN users u ON lm.user_id = u.id WHERE lm.lobby_id = $1 ORDER BY lm.slot_index', [lobby.id]);
        lobbyState = {
          id: lobby.id, code: lobby.code, name: lobby.name,
          hostUserId: lobby.host_user_id, maxPlayers: lobby.max_players,
          status: lobby.status,
          players: members.map(m => ({
            userId: m.user_id, username: m.username,
            characterId: m.character_id, characterName: null, characterClass: null, characterLevel: null,
            isReady: m.is_ready, slotIndex: m.slot_index
          }))
        };
        activeLobbies.set(lobby.id, lobbyState);
      }

      if (lobbyState.players.length >= lobbyState.maxPlayers) {
        return callback({ success: false, error: 'Lobby is full.' });
      }
      if (lobbyState.players.find(p => p.userId === socket.user.id)) {
        // Already in lobby — rejoin
        socket.join(`lobby:${lobby.id}`);
        socket.lobbyId = lobby.id;
        return callback({ success: true, lobby: lobbyState });
      }

      const slotIndex = lobbyState.players.length;
      await run('INSERT INTO lobby_members (lobby_id, user_id, slot_index) VALUES ($1, $2, $3)', [lobby.id, socket.user.id, slotIndex]);

      const playerInfo = {
        userId: socket.user.id, username: socket.user.username,
        characterId: null, characterName: null, characterClass: null, characterLevel: null,
        isReady: false, slotIndex
      };
      lobbyState.players.push(playerInfo);

      socket.join(`lobby:${lobby.id}`);
      socket.lobbyId = lobby.id;

      socket.to(`lobby:${lobby.id}`).emit('lobby:player_joined', { player: playerInfo, players: lobbyState.players });
      callback({ success: true, lobby: lobbyState });
    } catch (err) {
      console.error('Lobby join error:', err);
      callback({ success: false, error: 'Failed to join lobby.' });
    }
  });

  // Select character for lobby
  socket.on('lobby:select_character', async (data, callback) => {
    try {
      const { characterId } = data;
      const lobbyId = socket.lobbyId;
      if (!lobbyId) return callback({ success: false, error: 'Not in a lobby.' });
      const lobbyState = activeLobbies.get(lobbyId);
      if (!lobbyState) return callback({ success: false, error: 'Lobby not found.' });

      const char = await getOne('SELECT * FROM characters WHERE id = $1 AND user_id = $2', [characterId, socket.user.id]);
      if (!char) return callback({ success: false, error: 'Character not found.' });
      if (!char.is_alive) return callback({ success: false, error: 'Character is dead.' });

      await run('UPDATE lobby_members SET character_id = $1 WHERE lobby_id = $2 AND user_id = $3', [characterId, lobbyId, socket.user.id]);

      const player = lobbyState.players.find(p => p.userId === socket.user.id);
      if (player) {
        player.characterId = char.id;
        player.characterName = char.name;
        player.characterClass = char.class;
        player.characterLevel = char.level;
        player.isReady = false;
      }

      io.to(`lobby:${lobbyId}`).emit('lobby:character_selected', { userId: socket.user.id, character: { id: char.id, name: char.name, class: char.class, level: char.level, hp: char.hp, maxHp: char.max_hp, sp: char.sp, maxSp: char.max_sp }, players: lobbyState.players });
      callback({ success: true });
    } catch (err) {
      console.error('Select character error:', err);
      callback({ success: false, error: 'Failed to select character.' });
    }
  });

  // Toggle ready
  socket.on('lobby:ready', async (data, callback) => {
    try {
      const lobbyId = socket.lobbyId;
      if (!lobbyId) return callback({ success: false, error: 'Not in a lobby.' });
      const lobbyState = activeLobbies.get(lobbyId);
      if (!lobbyState) return callback({ success: false, error: 'Lobby not found.' });

      const player = lobbyState.players.find(p => p.userId === socket.user.id);
      if (!player) return callback({ success: false, error: 'Not in this lobby.' });
      if (!player.characterId) return callback({ success: false, error: 'Select a character first.' });

      player.isReady = !player.isReady;
      await run('UPDATE lobby_members SET is_ready = $1 WHERE lobby_id = $2 AND user_id = $3', [player.isReady, lobbyId, socket.user.id]);

      io.to(`lobby:${lobbyId}`).emit('lobby:player_ready', { userId: socket.user.id, isReady: player.isReady, players: lobbyState.players });
      callback({ success: true, isReady: player.isReady });
    } catch (err) {
      console.error('Ready error:', err);
      callback({ success: false, error: 'Failed to toggle ready.' });
    }
  });

  // Start game (host only)
  socket.on('lobby:start', async (data, callback) => {
    try {
      const lobbyId = socket.lobbyId;
      if (!lobbyId) return callback({ success: false, error: 'Not in a lobby.' });
      const lobbyState = activeLobbies.get(lobbyId);
      if (!lobbyState) return callback({ success: false, error: 'Lobby not found.' });
      if (lobbyState.hostUserId !== socket.user.id) return callback({ success: false, error: 'Only the host can start.' });
      if (lobbyState.players.length < 1) return callback({ success: false, error: 'Need at least 1 player.' });
      const allReady = lobbyState.players.every(p => p.isReady && p.characterId);
      if (!allReady) return callback({ success: false, error: 'All players must be ready with a character.' });

      // Create co-op session
      const session = await getOne(
        'INSERT INTO coop_sessions (lobby_id) VALUES ($1) RETURNING *',
        [lobbyId]
      );
      await run('UPDATE lobbies SET status = $1, updated_at = NOW() WHERE id = $2', ['in_progress', lobbyId]);

      lobbyState.status = 'in_progress';
      lobbyState.sessionId = session.id;

      io.to(`lobby:${lobbyId}`).emit('game:started', {
        sessionId: session.id,
        lobbyId: lobbyId,
        players: lobbyState.players,
        floor: 1
      });
      callback({ success: true, sessionId: session.id });
    } catch (err) {
      console.error('Start game error:', err);
      callback({ success: false, error: 'Failed to start game.' });
    }
  });

  // Chat message
  socket.on('lobby:chat', (data) => {
    const lobbyId = socket.lobbyId;
    if (!lobbyId) return;
    io.to(`lobby:${lobbyId}`).emit('lobby:chat_message', {
      userId: socket.user.id,
      username: socket.user.username,
      message: data.message?.substring(0, 200) || '',
      timestamp: Date.now()
    });
  });

  // Leave lobby
  socket.on('lobby:leave', async (callback) => {
    try {
      await handleLobbyLeave(io, socket);
      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      console.error('Leave lobby error:', err);
      if (typeof callback === 'function') callback({ success: false });
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    try {
      // Intentionally not calling handleLobbyLeave here so players can refresh
      // and reconnect without losing their lobby session.
      console.log(`Socket disconnected: ${socket.id}`);
    } catch (err) {
      console.error('Disconnect cleanup error:', err);
    }
  });
}

async function handleLobbyLeave(io, socket) {
  const lobbyId = socket.lobbyId;
  if (!lobbyId) return;

  const lobbyState = activeLobbies.get(lobbyId);
  if (!lobbyState) return;

  lobbyState.players = lobbyState.players.filter(p => p.userId !== socket.user.id);
  await run('DELETE FROM lobby_members WHERE lobby_id = $1 AND user_id = $2', [lobbyId, socket.user.id]);

  socket.leave(`lobby:${lobbyId}`);
  socket.lobbyId = null;

  if (lobbyState.players.length === 0) {
    // Disband lobby
    await run('UPDATE lobbies SET status = $1, updated_at = NOW() WHERE id = $2', ['abandoned', lobbyId]);
    activeLobbies.delete(lobbyId);
  } else {
    // Transfer host if needed
    if (lobbyState.hostUserId === socket.user.id) {
      lobbyState.hostUserId = lobbyState.players[0].userId;
      await run('UPDATE lobbies SET host_user_id = $1, updated_at = NOW() WHERE id = $2', [lobbyState.hostUserId, lobbyId]);
    }
    io.to(`lobby:${lobbyId}`).emit('lobby:player_left', {
      userId: socket.user.id,
      username: socket.user.username,
      newHostId: lobbyState.hostUserId,
      players: lobbyState.players
    });
  }
}

function getActiveLobbies() {
  return activeLobbies;
}

module.exports = { registerLobbyHandlers, getActiveLobbies };
