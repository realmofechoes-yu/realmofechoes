const express = require('express');
const { getOne, getAll } = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/lobby/active - Get active lobbies (for listing)
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const lobbies = await getAll(
      `SELECT l.*, COUNT(lm.id) as player_count 
       FROM lobbies l 
       LEFT JOIN lobby_members lm ON l.id = lm.lobby_id 
       WHERE l.status = 'waiting' 
       GROUP BY l.id 
       ORDER BY l.created_at DESC 
       LIMIT 20`
    );
    res.json(lobbies);
  } catch (err) {
    console.error('Active lobbies error:', err);
    res.status(500).json({ error: 'Server error fetching lobbies.' });
  }
});

// GET /api/lobby/:code - Get lobby by code
router.get('/:code', authMiddleware, async (req, res) => {
  try {
    const lobby = await getOne('SELECT * FROM lobbies WHERE code = $1', [req.params.code.toUpperCase()]);
    if (!lobby) return res.status(404).json({ error: 'Lobby not found.' });

    const members = await getAll(
      `SELECT lm.*, u.username 
       FROM lobby_members lm 
       JOIN users u ON lm.user_id = u.id 
       WHERE lm.lobby_id = $1 
       ORDER BY lm.slot_index`,
      [lobby.id]
    );

    res.json({ lobby, members });
  } catch (err) {
    console.error('Get lobby error:', err);
    res.status(500).json({ error: 'Server error fetching lobby.' });
  }
});

module.exports = router;
