const express = require('express');
const { getDatabase } = require('../db/database');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * GET /api/trading-days
 * List all trading days with optional filters
 */
router.get('/trading-days', (req, res) => {
  try {
    const db = getDatabase();
    const { from, to, has_outlook, has_review, limit = 30, offset = 0 } = req.query;

    let whereClause = '1=1';
    const params = [];

    if (from) {
      whereClause += ' AND date >= ?';
      params.push(from);
    }
    if (to) {
      whereClause += ' AND date <= ?';
      params.push(to);
    }
    if (has_outlook !== undefined) {
      whereClause += ' AND has_outlook = ?';
      params.push(has_outlook === 'true' ? 1 : 0);
    }
    if (has_review !== undefined) {
      whereClause += ' AND has_review = ?';
      params.push(has_review === 'true' ? 1 : 0);
    }

    params.push(parseInt(limit), parseInt(offset));

    const days = db.prepare(`
      SELECT * FROM trading_days
      WHERE ${whereClause}
      ORDER BY date DESC
      LIMIT ? OFFSET ?
    `).all(...params);

    // Parse JSON fields
    const parsedDays = days.map(day => ({
      ...day,
      outlook_data: day.outlook_data ? JSON.parse(day.outlook_data) : null,
      review_data: day.review_data ? JSON.parse(day.review_data) : null
    }));

    res.json({
      success: true,
      data: parsedDays
    });
  } catch (error) {
    logger.error('Error fetching trading days:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trading days',
      message: error.message
    });
  }
});

/**
 * GET /api/trading-days/latest
 * Get the most recent trading day
 */
router.get('/trading-days/latest', (req, res) => {
  try {
    const db = getDatabase();

    const day = db.prepare(`
      SELECT * FROM trading_days
      ORDER BY date DESC
      LIMIT 1
    `).get();

    if (!day) {
      return res.json({
        success: true,
        data: null,
        message: 'No trading days found'
      });
    }

    res.json({
      success: true,
      data: {
        ...day,
        outlook_data: day.outlook_data ? JSON.parse(day.outlook_data) : null,
        review_data: day.review_data ? JSON.parse(day.review_data) : null
      }
    });
  } catch (error) {
    logger.error('Error fetching latest trading day:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch latest trading day',
      message: error.message
    });
  }
});

/**
 * GET /api/trading-days/today
 * Get today's trading day (convenience endpoint)
 */
router.get('/trading-days/today', (req, res) => {
  try {
    const db = getDatabase();
    const today = getTodayDate();

    let day = db.prepare('SELECT * FROM trading_days WHERE date = ?').get(today);

    // Get today's trades
    const trades = db.prepare(`
      SELECT * FROM trades
      WHERE DATE(opened_at) = ?
      ORDER BY opened_at ASC
    `).all(today);

    if (!day) {
      return res.json({
        success: true,
        data: {
          date: today,
          has_outlook: false,
          has_review: false,
          outlook_data: null,
          review_data: null,
          trades
        },
        message: 'No trading day created yet for today'
      });
    }

    res.json({
      success: true,
      data: {
        ...day,
        outlook_data: day.outlook_data ? JSON.parse(day.outlook_data) : null,
        review_data: day.review_data ? JSON.parse(day.review_data) : null,
        trades
      }
    });
  } catch (error) {
    logger.error('Error fetching today\'s trading day:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch today\'s trading day',
      message: error.message
    });
  }
});

/**
 * GET /api/trading-days/:date
 * Get a specific trading day by date
 */
router.get('/trading-days/:date', (req, res) => {
  try {
    const db = getDatabase();
    const { date } = req.params;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    const day = db.prepare('SELECT * FROM trading_days WHERE date = ?').get(date);

    // Get trades for this day
    const trades = db.prepare(`
      SELECT * FROM trades
      WHERE DATE(opened_at) = ?
      ORDER BY opened_at ASC
    `).all(date);

    if (!day) {
      return res.json({
        success: true,
        data: {
          date,
          has_outlook: false,
          has_review: false,
          outlook_data: null,
          review_data: null,
          trades
        },
        message: 'No trading day found for this date'
      });
    }

    res.json({
      success: true,
      data: {
        ...day,
        outlook_data: day.outlook_data ? JSON.parse(day.outlook_data) : null,
        review_data: day.review_data ? JSON.parse(day.review_data) : null,
        trades
      }
    });
  } catch (error) {
    logger.error('Error fetching trading day:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trading day',
      message: error.message
    });
  }
});

/**
 * POST /api/trading-days/:date/outlook
 * Save daily outlook for a specific date
 */
router.post('/trading-days/:date/outlook', (req, res) => {
  try {
    const db = getDatabase();
    const { date } = req.params;
    const outlookData = req.body;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Required fields for outlook
    const { bias } = outlookData;
    if (!bias) {
      return res.status(400).json({
        success: false,
        error: 'Bias is required for daily outlook'
      });
    }

    // Check if day exists
    let day = db.prepare('SELECT * FROM trading_days WHERE date = ?').get(date);
    const outlookJson = JSON.stringify(outlookData);
    const now = new Date().toISOString();

    if (day) {
      // Update existing day
      db.prepare(`
        UPDATE trading_days SET
          has_outlook = 1,
          outlook_data = ?,
          updated_at = ?
        WHERE date = ?
      `).run(outlookJson, now, date);
    } else {
      // Create new day
      db.prepare(`
        INSERT INTO trading_days (date, has_outlook, outlook_data, created_at, updated_at)
        VALUES (?, 1, ?, ?, ?)
      `).run(date, outlookJson, now, now);
    }

    // Fetch updated day
    day = db.prepare('SELECT * FROM trading_days WHERE date = ?').get(date);

    logger.info(`Daily outlook saved for ${date}`);
    res.json({
      success: true,
      data: {
        ...day,
        outlook_data: JSON.parse(day.outlook_data)
      },
      message: `Daily outlook saved for ${date}`
    });
  } catch (error) {
    logger.error('Error saving daily outlook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save daily outlook',
      message: error.message
    });
  }
});

/**
 * POST /api/trading-days/:date/review
 * Save daily review for a specific date
 */
router.post('/trading-days/:date/review', (req, res) => {
  try {
    const db = getDatabase();
    const { date } = req.params;
    const reviewData = req.body;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Check if day exists
    let day = db.prepare('SELECT * FROM trading_days WHERE date = ?').get(date);
    const reviewJson = JSON.stringify(reviewData);
    const now = new Date().toISOString();

    if (day) {
      // Update existing day
      db.prepare(`
        UPDATE trading_days SET
          has_review = 1,
          review_data = ?,
          updated_at = ?
        WHERE date = ?
      `).run(reviewJson, now, date);
    } else {
      // Create new day
      db.prepare(`
        INSERT INTO trading_days (date, has_review, review_data, created_at, updated_at)
        VALUES (?, 1, ?, ?, ?)
      `).run(date, reviewJson, now, now);
    }

    // Fetch updated day
    day = db.prepare('SELECT * FROM trading_days WHERE date = ?').get(date);

    logger.info(`Daily review saved for ${date}`);
    res.json({
      success: true,
      data: {
        ...day,
        outlook_data: day.outlook_data ? JSON.parse(day.outlook_data) : null,
        review_data: JSON.parse(day.review_data)
      },
      message: `Daily review saved for ${date}`
    });
  } catch (error) {
    logger.error('Error saving daily review:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save daily review',
      message: error.message
    });
  }
});

/**
 * GET /api/trading-days/:date/check-review
 * Check if previous day has a review (useful before creating new outlook)
 */
router.get('/trading-days/:date/check-review', (req, res) => {
  try {
    const db = getDatabase();
    const { date } = req.params;

    // Get previous day
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split('T')[0];

    const prevDay = db.prepare('SELECT * FROM trading_days WHERE date = ?').get(prevDateStr);

    // Check if previous day had trades but no review
    const prevTrades = db.prepare(`
      SELECT COUNT(*) as count FROM trades
      WHERE DATE(opened_at) = ?
    `).get(prevDateStr);

    const needsReview = prevTrades.count > 0 && (!prevDay || !prevDay.has_review);

    res.json({
      success: true,
      data: {
        previous_date: prevDateStr,
        had_trades: prevTrades.count > 0,
        has_review: prevDay?.has_review || false,
        needs_review: needsReview
      },
      message: needsReview
        ? `You had ${prevTrades.count} trade(s) on ${prevDateStr} but haven't reviewed. Consider reviewing first.`
        : 'Previous day is reviewed or had no trades.'
    });
  } catch (error) {
    logger.error('Error checking review status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check review status',
      message: error.message
    });
  }
});

/**
 * DELETE /api/trading-days/:date
 * Delete a trading day (for cleanup/testing)
 */
router.delete('/trading-days/:date', (req, res) => {
  try {
    const db = getDatabase();
    const { date } = req.params;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    const day = db.prepare('SELECT * FROM trading_days WHERE date = ?').get(date);

    if (!day) {
      return res.status(404).json({
        success: false,
        error: `No trading day found for ${date}`
      });
    }

    db.prepare('DELETE FROM trading_days WHERE date = ?').run(date);

    logger.info(`Deleted trading day for ${date}`);
    res.json({
      success: true,
      message: `Trading day for ${date} deleted`
    });
  } catch (error) {
    logger.error('Error deleting trading day:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete trading day',
      message: error.message
    });
  }
});

module.exports = router;
