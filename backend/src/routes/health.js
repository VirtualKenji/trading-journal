const express = require('express');
const { getDatabase } = require('../db/database');

const router = express.Router();

/**
 * Health check endpoint
 * GET /api/health
 */
router.get('/health', (req, res) => {
  try {
    const db = getDatabase();

    // Test database connection
    const result = db.prepare('SELECT 1 as test').get();

    // Count tables
    const tables = db.prepare(`
      SELECT COUNT(*) as count
      FROM sqlite_master
      WHERE type='table'
    `).get();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        tables: tables.count
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;
