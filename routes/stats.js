const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET /api/stats - Return dashboard metrics
router.get('/', async (req, res) => {
  try {
    const stats = await db.getStatsAsync();
    return res.json(stats);
  } catch (err) {
    console.error('Erro ao consultar estatísticas:', err);
    return res.status(500).json({ error: 'Erro interno ao carregar estatísticas.' });
  }
});

module.exports = router;
