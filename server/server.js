const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

const { initSchema, closeDb } = require('./db/database');
const socketAuthMiddleware = require('./socket/auth-middleware');
const { registerLobbyHandlers } = require('./socket/lobby-handlers');
const { registerGameHandlers, createSession } = require('./socket/game-handlers');
const { registerCombatHandlers } = require('./socket/combat-handlers');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Socket.IO setup
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Socket.IO auth middleware
io.use(socketAuthMiddleware);

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.user.username} (${socket.id})`);

  registerLobbyHandlers(io, socket);
  registerGameHandlers(io, socket);
  registerCombatHandlers(io, socket);

  // When game starts, create session reference
  socket.on('game:session_created', (data) => {
    if (data.sessionId && data.lobbyId) {
      createSession(data.lobbyId, data.sessionId);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.user?.username} (${socket.id})`);
  });
});

// Express middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/characters', require('./routes/characters'));
app.use('/api/dungeon', require('./routes/dungeon'));
app.use('/api/combat', require('./routes/combat'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/lobby', require('./routes/lobby'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', game: 'Realm of Echoes', version: '2.0.0-coop', sockets: io.engine.clientsCount });
});

// 404 handler for API routes (must come after all API routes)
app.all('/api/{*path}', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Serve static files in production
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));
app.get('{*path}', (req, res) => {
  const indexPath = path.join(clientBuildPath, 'index.html');
  const fs = require('fs');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Global error handler — always return JSON, never HTML
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  io.close();
  await closeDb();
  process.exit(0);
});

// Initialize database and start server
async function start() {
  try {
    await initSchema();
    server.listen(PORT, () => {
      console.log(`\n⚔️  Realm of Echoes server running on http://localhost:${PORT}`);
      console.log(`📡 API available at http://localhost:${PORT}/api`);
      console.log(`🔌 Socket.IO ready for co-op connections`);
      console.log(`🗡️  Ready for adventure!\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

module.exports = { app, io };
