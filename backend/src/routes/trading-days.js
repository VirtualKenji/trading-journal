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
 * Fetch outlook from daily_outlooks table
 */
function getOutlookForDay(db, tradingDayId) {
  if (!tradingDayId) return null;

  const outlook = db.prepare(`
    SELECT * FROM daily_outlooks WHERE trading_day_id = ?
  `).get(tradingDayId);

  if (!outlook) return null;

  return {
    id: outlook.id,
    bias: outlook.bias,
    bias_reasoning: outlook.bias_reasoning,
    htf_bias: outlook.htf_bias,
    key_levels: outlook.key_levels ? JSON.parse(outlook.key_levels) : null,
    setups: outlook.setups ? JSON.parse(outlook.setups) : null,
    no_trade_zone: outlook.no_trade_zone ? JSON.parse(outlook.no_trade_zone) : null,
    contingency: outlook.contingency ? JSON.parse(outlook.contingency) : null,
    invalidation: outlook.invalidation ? JSON.parse(outlook.invalidation) : null,
    bull_arguments: outlook.bull_arguments ? JSON.parse(outlook.bull_arguments) : null,
    bear_arguments: outlook.bear_arguments ? JSON.parse(outlook.bear_arguments) : null,
    created_at: outlook.created_at,
    updated_at: outlook.updated_at
  };
}

/**
 * Fetch review from daily_reviews table
 */
function getReviewForDay(db, tradingDayId) {
  if (!tradingDayId) return null;

  const review = db.prepare(`
    SELECT * FROM daily_reviews WHERE trading_day_id = ?
  `).get(tradingDayId);

  if (!review) return null;

  return {
    id: review.id,
    outlook_grade: review.outlook_grade,
    execution_grade: review.execution_grade,
    emotional_grade: review.emotional_grade,
    bias_correct: review.bias_correct,
    reflection: review.reflection,
    lessons: review.lessons ? JSON.parse(review.lessons) : null,
    hindsight: review.hindsight ? JSON.parse(review.hindsight) : null,
    action_items: review.action_items ? JSON.parse(review.action_items) : null,
    trades_won: review.trades_won,
    trades_lost: review.trades_lost,
    total_pnl: review.total_pnl,
    created_at: review.created_at,
    updated_at: review.updated_at
  };
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

    // Fetch outlook and review from separate tables
    const parsedDays = days.map(day => ({
      ...day,
      outlook_data: getOutlookForDay(db, day.id),
      review_data: getReviewForDay(db, day.id)
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
        outlook_data: getOutlookForDay(db, day.id),
        review_data: getReviewForDay(db, day.id)
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
        outlook_data: getOutlookForDay(db, day.id),
        review_data: getReviewForDay(db, day.id),
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
        outlook_data: getOutlookForDay(db, day.id),
        review_data: getReviewForDay(db, day.id),
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
 * Save daily outlook for a specific date (writes to daily_outlooks table)
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

    const now = new Date().toISOString();

    // Ensure trading_day exists
    let day = db.prepare('SELECT * FROM trading_days WHERE date = ?').get(date);
    if (!day) {
      db.prepare(`
        INSERT INTO trading_days (date, has_outlook, created_at, updated_at)
        VALUES (?, 1, ?, ?)
      `).run(date, now, now);
      day = db.prepare('SELECT * FROM trading_days WHERE date = ?').get(date);
    } else {
      db.prepare(`
        UPDATE trading_days SET has_outlook = 1, updated_at = ? WHERE date = ?
      `).run(now, date);
    }

    // Check if outlook already exists for this day
    const existingOutlook = db.prepare(`
      SELECT id FROM daily_outlooks WHERE trading_day_id = ?
    `).get(day.id);

    if (existingOutlook) {
      // Update existing outlook
      db.prepare(`
        UPDATE daily_outlooks SET
          bias = ?, bias_reasoning = ?, htf_bias = ?,
          key_levels = ?, setups = ?, no_trade_zone = ?,
          contingency = ?, invalidation = ?,
          bull_arguments = ?, bear_arguments = ?,
          updated_at = ?
        WHERE trading_day_id = ?
      `).run(
        outlookData.bias,
        outlookData.bias_reasoning || null,
        outlookData.htf_bias || null,
        outlookData.key_levels ? JSON.stringify(outlookData.key_levels) : null,
        outlookData.setups ? JSON.stringify(outlookData.setups) : null,
        outlookData.no_trade_zone ? JSON.stringify(outlookData.no_trade_zone) : null,
        outlookData.contingency ? JSON.stringify(outlookData.contingency) : null,
        outlookData.invalidation ? JSON.stringify(outlookData.invalidation) : null,
        outlookData.bull_arguments ? JSON.stringify(outlookData.bull_arguments) : null,
        outlookData.bear_arguments ? JSON.stringify(outlookData.bear_arguments) : null,
        now,
        day.id
      );
    } else {
      // Insert new outlook
      db.prepare(`
        INSERT INTO daily_outlooks (
          trading_day_id, bias, bias_reasoning, htf_bias,
          key_levels, setups, no_trade_zone, contingency, invalidation,
          bull_arguments, bear_arguments, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        day.id,
        outlookData.bias,
        outlookData.bias_reasoning || null,
        outlookData.htf_bias || null,
        outlookData.key_levels ? JSON.stringify(outlookData.key_levels) : null,
        outlookData.setups ? JSON.stringify(outlookData.setups) : null,
        outlookData.no_trade_zone ? JSON.stringify(outlookData.no_trade_zone) : null,
        outlookData.contingency ? JSON.stringify(outlookData.contingency) : null,
        outlookData.invalidation ? JSON.stringify(outlookData.invalidation) : null,
        outlookData.bull_arguments ? JSON.stringify(outlookData.bull_arguments) : null,
        outlookData.bear_arguments ? JSON.stringify(outlookData.bear_arguments) : null,
        now,
        now
      );
    }

    // Fetch updated day with outlook
    day = db.prepare('SELECT * FROM trading_days WHERE date = ?').get(date);

    logger.info(`Daily outlook saved for ${date}`);
    res.json({
      success: true,
      data: {
        ...day,
        outlook_data: getOutlookForDay(db, day.id)
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
 * Save daily review for a specific date (writes to daily_reviews table)
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

    const now = new Date().toISOString();

    // Ensure trading_day exists
    let day = db.prepare('SELECT * FROM trading_days WHERE date = ?').get(date);
    if (!day) {
      db.prepare(`
        INSERT INTO trading_days (date, has_review, created_at, updated_at)
        VALUES (?, 1, ?, ?)
      `).run(date, now, now);
      day = db.prepare('SELECT * FROM trading_days WHERE date = ?').get(date);
    } else {
      db.prepare(`
        UPDATE trading_days SET has_review = 1, updated_at = ? WHERE date = ?
      `).run(now, date);
    }

    // Check if review already exists for this day
    const existingReview = db.prepare(`
      SELECT id FROM daily_reviews WHERE trading_day_id = ?
    `).get(day.id);

    if (existingReview) {
      // Update existing review
      db.prepare(`
        UPDATE daily_reviews SET
          outlook_grade = ?, execution_grade = ?, emotional_grade = ?,
          bias_correct = ?, reflection = ?,
          lessons = ?, hindsight = ?, action_items = ?,
          trades_won = ?, trades_lost = ?, total_pnl = ?,
          updated_at = ?
        WHERE trading_day_id = ?
      `).run(
        reviewData.outlook_grade || reviewData.prediction_grade || null,
        reviewData.execution_grade || null,
        reviewData.emotional_grade || null,
        reviewData.bias_correct !== undefined ? (reviewData.bias_correct ? 1 : 0) : null,
        reviewData.reflection || null,
        reviewData.lessons ? JSON.stringify(reviewData.lessons) : null,
        reviewData.hindsight ? JSON.stringify(reviewData.hindsight) : null,
        reviewData.action_items ? JSON.stringify(reviewData.action_items) : null,
        reviewData.trades_won || 0,
        reviewData.trades_lost || 0,
        reviewData.total_pnl || null,
        now,
        day.id
      );
    } else {
      // Insert new review
      db.prepare(`
        INSERT INTO daily_reviews (
          trading_day_id, outlook_grade, execution_grade, emotional_grade,
          bias_correct, reflection, lessons, hindsight, action_items,
          trades_won, trades_lost, total_pnl, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        day.id,
        reviewData.outlook_grade || reviewData.prediction_grade || null,
        reviewData.execution_grade || null,
        reviewData.emotional_grade || null,
        reviewData.bias_correct !== undefined ? (reviewData.bias_correct ? 1 : 0) : null,
        reviewData.reflection || null,
        reviewData.lessons ? JSON.stringify(reviewData.lessons) : null,
        reviewData.hindsight ? JSON.stringify(reviewData.hindsight) : null,
        reviewData.action_items ? JSON.stringify(reviewData.action_items) : null,
        reviewData.trades_won || 0,
        reviewData.trades_lost || 0,
        reviewData.total_pnl || null,
        now,
        now
      );
    }

    // Fetch updated day with review
    day = db.prepare('SELECT * FROM trading_days WHERE date = ?').get(date);

    logger.info(`Daily review saved for ${date}`);
    res.json({
      success: true,
      data: {
        ...day,
        outlook_data: getOutlookForDay(db, day.id),
        review_data: getReviewForDay(db, day.id)
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

    // Delete related records from new tables first
    db.prepare('DELETE FROM daily_outlooks WHERE trading_day_id = ?').run(day.id);
    db.prepare('DELETE FROM daily_reviews WHERE trading_day_id = ?').run(day.id);
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
