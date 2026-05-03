const express = require('express');
const { getDb } = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/leaderboard
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const leaderboard = db.prepare(`
      SELECT u.id, u.username, u.deepest_floor, u.total_gold, u.total_runs,
             (SELECT COUNT(*) FROM characters c WHERE c.user_id = u.id) as total_characters
      FROM users u
      ORDER BY u.deepest_floor DESC, u.total_gold DESC
      LIMIT 50
    `).all();

    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Server error fetching leaderboard.' });
  }
});

// GET /api/leaderboard/achievements/:userId
router.get('/achievements/:userId', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const achievements = db.prepare('SELECT * FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC').all(req.params.userId);
    res.json(achievements);
  } catch (err) {
    console.error('Achievements error:', err);
    res.status(500).json({ error: 'Server error fetching achievements.' });
  }
});

module.exports = router;
