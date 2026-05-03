const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { getDb, closeDb } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
getDb();

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/characters', require('./routes/characters'));
app.use('/api/dungeon', require('./routes/dungeon'));
app.use('/api/combat', require('./routes/combat'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/leaderboard', require('./routes/leaderboard'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', game: 'Realm of Echoes', version: '1.0.0' });
});

// Serve static files in production
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));
app.get('{*path}', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`\n⚔️  Realm of Echoes server running on http://localhost:${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`🗡️  Ready for adventure!\n`);
});

module.exports = app;
