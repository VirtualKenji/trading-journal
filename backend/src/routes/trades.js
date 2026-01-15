const express = require('express');
const { getDatabase } = require('../db/database');
const { generateTradeNumber, getTodayDate } = require('../services/tradeNumbering');
const { detectSession } = require('../services/sessionDetection');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Get lessons relevant to a trade's context
 * @param {Object} trade - Trade object with setup, session, trigger, location, initial_emotion
 * @returns {Array} Relevant lessons with scores
 */
function getRelevantLessonsForTrade(trade) {
  const db = getDatabase();

  // Get active lessons with conditions
  const lessons = db.prepare(`
    SELECT l.*, lc.name as category_name
    FROM lessons l
    LEFT JOIN lesson_categories lc ON l.category_id = lc.id
    WHERE l.status = 'active' AND l.conditions IS NOT NULL
  `).all();

  // Score each lesson by how well it matches the trade
  const scoredLessons = lessons.map(lesson => {
    const conditions = JSON.parse(lesson.conditions);
    let score = 0;
    let matches = [];

    if (trade.setup && conditions.setup?.includes(trade.setup)) {
      score += 3;
      matches.push('setup');
    }
    if (trade.session && conditions.session?.includes(trade.session)) {
      score += 2;
      matches.push('session');
    }
    if (trade.trigger && conditions.trigger?.includes(trade.trigger)) {
      score += 3;
      matches.push('trigger');
    }
    if (trade.initial_emotion && conditions.emotion?.includes(trade.initial_emotion)) {
      score += 2;
      matches.push('emotion');
    }
    if (trade.location && conditions.location?.includes(trade.location)) {
      score += 2;
      matches.push('location');
    }

    return {
      id: lesson.id,
      title: lesson.title,
      content: lesson.content,
      category_name: lesson.category_name,
      relevance_score: score,
      matched_on: matches
    };
  });

  // Filter to only matching lessons, sort by score, return top 3
  return scoredLessons
    .filter(l => l.relevance_score > 0)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 3);
}

/**
 * POST /api/trades
 * Create a new trade
 */
router.post('/trades', (req, res) => {
  try {
    const db = getDatabase();
    const {
      asset,
      direction,
      entry_price,
      position_size,
      collateral,
      leverage,
      liquidation_price,
      setup,
      location,
      trigger,
      initial_emotion,
      planned_in_outlook = false
    } = req.body;

    // Validate required fields
    if (!asset || !direction) {
      return res.status(400).json({
        success: false,
        error: 'Asset and direction are required'
      });
    }

    if (!['long', 'short'].includes(direction.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Direction must be "long" or "short"'
      });
    }

    // Generate trade number and detect session
    const today = getTodayDate();
    const trade_number = generateTradeNumber(today);
    const opened_at = new Date().toISOString();
    const session = detectSession(opened_at);

    // Get or create trading day
    let tradingDay = db.prepare('SELECT id FROM trading_days WHERE date = ?').get(today);
    if (!tradingDay) {
      const result = db.prepare('INSERT INTO trading_days (date) VALUES (?)').run(today);
      tradingDay = { id: result.lastInsertRowid };
    }

    // Insert trade
    const stmt = db.prepare(`
      INSERT INTO trades (
        trade_number, trading_day_id, asset, direction, entry_price,
        position_size, collateral, leverage, liquidation_price, setup, location,
        trigger, session, initial_emotion, planned_in_outlook, status, opened_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `);

    const result = stmt.run(
      trade_number,
      tradingDay.id,
      asset,
      direction.toLowerCase(),
      entry_price || null,
      position_size || null,
      collateral || null,
      leverage || null,
      liquidation_price || null,
      setup || null,
      location || null,
      trigger || null,
      session,
      initial_emotion || null,
      planned_in_outlook ? 1 : 0,
      opened_at
    );

    // Fetch the created trade
    const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(result.lastInsertRowid);

    // Get relevant lessons for this trade context
    const relevantLessons = getRelevantLessonsForTrade(trade);

    logger.info(`Trade created: ${trade_number}`);
    res.status(201).json({
      success: true,
      data: trade,
      relevant_lessons: relevantLessons,
      message: `Trade ${trade_number} created successfully`
    });
  } catch (error) {
    logger.error('Error creating trade:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create trade',
      message: error.message
    });
  }
});

/**
 * GET /api/trades
 * List trades with optional filters
 * Query params: status, setup, location, session, outcome, from, to, limit, offset
 */
router.get('/trades', (req, res) => {
  try {
    const db = getDatabase();
    const {
      status,
      setup,
      location,
      session,
      outcome,
      direction,
      asset,
      from,
      to,
      limit = 100,
      offset = 0
    } = req.query;

    let whereClause = '1=1';
    const params = [];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    if (setup) {
      whereClause += ' AND setup = ?';
      params.push(setup);
    }
    if (location) {
      whereClause += ' AND location = ?';
      params.push(location);
    }
    if (session) {
      whereClause += ' AND session = ?';
      params.push(session);
    }
    if (outcome) {
      whereClause += ' AND outcome = ?';
      params.push(outcome);
    }
    if (direction) {
      whereClause += ' AND direction = ?';
      params.push(direction.toLowerCase());
    }
    if (asset) {
      whereClause += ' AND asset LIKE ?';
      params.push(`%${asset}%`);
    }
    if (from) {
      whereClause += ' AND DATE(opened_at) >= ?';
      params.push(from);
    }
    if (to) {
      whereClause += ' AND DATE(opened_at) <= ?';
      params.push(to);
    }

    // Get total count
    const countResult = db.prepare(`SELECT COUNT(*) as count FROM trades WHERE ${whereClause}`).get(...params);

    // Get trades
    params.push(parseInt(limit), parseInt(offset));
    const trades = db.prepare(`
      SELECT * FROM trades
      WHERE ${whereClause}
      ORDER BY opened_at DESC
      LIMIT ? OFFSET ?
    `).all(...params);

    res.json({
      success: true,
      data: trades,
      meta: {
        total: countResult.count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    logger.error('Error fetching trades:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trades',
      message: error.message
    });
  }
});

/**
 * GET /api/trades/open
 * Get all currently open trades
 */
router.get('/trades/open', (req, res) => {
  try {
    const db = getDatabase();
    const trades = db.prepare(`
      SELECT * FROM trades
      WHERE status = 'open'
      ORDER BY opened_at DESC
    `).all();

    res.json({
      success: true,
      data: trades,
      count: trades.length
    });
  } catch (error) {
    logger.error('Error fetching open trades:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch open trades',
      message: error.message
    });
  }
});

/**
 * GET /api/trades/:id
 * Get a single trade by ID or trade_number
 */
router.get('/trades/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    // Try to find by ID first, then by trade_number
    let trade;
    if (/^\d+$/.test(id)) {
      trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(id);
    }
    if (!trade) {
      // Try by trade_number (supports both full number and short form like "T1")
      let tradeNumber = id;
      if (/^T\d+$/i.test(id)) {
        // Short form: find by today's date + T#
        const today = getTodayDate();
        tradeNumber = `${today}-${id.toUpperCase()}`;
      }
      trade = db.prepare('SELECT * FROM trades WHERE trade_number = ?').get(tradeNumber);
    }

    if (!trade) {
      return res.status(404).json({
        success: false,
        error: 'Trade not found'
      });
    }

    // Get trade updates
    const updates = db.prepare(`
      SELECT * FROM trade_updates
      WHERE trade_id = ?
      ORDER BY created_at ASC
    `).all(trade.id);

    res.json({
      success: true,
      data: {
        ...trade,
        updates
      }
    });
  } catch (error) {
    logger.error('Error fetching trade:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trade',
      message: error.message
    });
  }
});

/**
 * PUT /api/trades/:id
 * Update a trade
 */
router.put('/trades/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const updates = req.body;

    // Find the trade
    let trade = db.prepare('SELECT * FROM trades WHERE id = ? OR trade_number = ?').get(id, id);
    if (!trade) {
      return res.status(404).json({
        success: false,
        error: 'Trade not found'
      });
    }

    // Build update query dynamically
    const allowedFields = [
      'asset', 'direction', 'entry_price', 'exit_price', 'position_size',
      'collateral', 'leverage', 'liquidation_price', 'setup', 'location', 'trigger',
      'initial_emotion', 'planned_in_outlook'
    ];

    const setClauses = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    setClauses.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(trade.id);

    db.prepare(`UPDATE trades SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);

    // Fetch updated trade
    const updatedTrade = db.prepare('SELECT * FROM trades WHERE id = ?').get(trade.id);

    logger.info(`Trade updated: ${trade.trade_number}`);
    res.json({
      success: true,
      data: updatedTrade
    });
  } catch (error) {
    logger.error('Error updating trade:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update trade',
      message: error.message
    });
  }
});

/**
 * POST /api/trades/:id/close
 * Close a trade with exit price and calculate PnL
 */
router.post('/trades/:id/close', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { exit_price, exit_emotion } = req.body;

    // Find the trade
    let trade = db.prepare('SELECT * FROM trades WHERE id = ? OR trade_number = ?').get(id, id);

    // Also try short form (T1, T2, etc.)
    if (!trade && /^T\d+$/i.test(id)) {
      const today = getTodayDate();
      const tradeNumber = `${today}-${id.toUpperCase()}`;
      trade = db.prepare('SELECT * FROM trades WHERE trade_number = ?').get(tradeNumber);
    }

    if (!trade) {
      return res.status(404).json({
        success: false,
        error: 'Trade not found'
      });
    }

    if (trade.status === 'closed') {
      return res.status(400).json({
        success: false,
        error: 'Trade is already closed'
      });
    }

    if (!exit_price) {
      return res.status(400).json({
        success: false,
        error: 'Exit price is required'
      });
    }

    // Calculate PnL
    let pnl = null;
    let pnl_percentage = null;
    let roi = null;
    let outcome = 'breakeven';

    if (trade.entry_price) {
      const priceChange = exit_price - trade.entry_price;
      const direction_multiplier = trade.direction === 'long' ? 1 : -1;
      const leverage = trade.leverage || 1;

      // Price change percentage (leveraged)
      pnl_percentage = (priceChange / trade.entry_price) * 100 * direction_multiplier * leverage;

      // Absolute PnL (if position_size or collateral available)
      if (trade.collateral) {
        // PnL based on collateral: collateral * (price_change% * leverage)
        pnl = trade.collateral * (pnl_percentage / 100);
        // ROI = PnL / collateral * 100 (same as pnl_percentage when using collateral)
        roi = (pnl / trade.collateral) * 100;
      } else if (trade.position_size) {
        // Fallback: PnL based on notional position size
        pnl = (trade.position_size * pnl_percentage) / 100;
      }

      if (pnl !== null) {
        if (pnl > 0) {
          outcome = 'win';
        } else if (pnl < 0) {
          outcome = 'loss';
        }
      }
    }

    const closed_at = new Date().toISOString();

    // Update trade
    db.prepare(`
      UPDATE trades SET
        exit_price = ?,
        pnl = ?,
        pnl_percentage = ?,
        roi = ?,
        outcome = ?,
        status = 'closed',
        closed_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(exit_price, pnl, pnl_percentage, roi, outcome, closed_at, closed_at, trade.id);

    // Add exit emotion as an update if provided
    if (exit_emotion) {
      db.prepare(`
        INSERT INTO trade_updates (trade_id, update_type, content, emotion)
        VALUES (?, 'close', 'Trade closed', ?)
      `).run(trade.id, exit_emotion);
    }

    // Fetch updated trade
    const closedTrade = db.prepare('SELECT * FROM trades WHERE id = ?').get(trade.id);

    const roiStr = roi !== null ? ` | ROI: ${roi.toFixed(2)}%` : '';
    logger.info(`Trade closed: ${trade.trade_number} - ${outcome} - PnL: ${pnl?.toFixed(2)}${roiStr}`);
    res.json({
      success: true,
      data: closedTrade,
      message: `Trade ${trade.trade_number} closed. ${outcome.toUpperCase()} - PnL: $${pnl?.toFixed(2)} (${pnl_percentage?.toFixed(2)}%)${roiStr}`
    });
  } catch (error) {
    logger.error('Error closing trade:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to close trade',
      message: error.message
    });
  }
});

/**
 * POST /api/trades/:id/updates
 * Add an update to a trade (note, emotion, etc.)
 */
router.post('/trades/:id/updates', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { content, emotion, update_type = 'note' } = req.body;

    // Find the trade
    let trade = db.prepare('SELECT * FROM trades WHERE id = ? OR trade_number = ?').get(id, id);

    // Also try short form (T1, T2, etc.)
    if (!trade && /^T\d+$/i.test(id)) {
      const today = getTodayDate();
      const tradeNumber = `${today}-${id.toUpperCase()}`;
      trade = db.prepare('SELECT * FROM trades WHERE trade_number = ?').get(tradeNumber);
    }

    if (!trade) {
      return res.status(404).json({
        success: false,
        error: 'Trade not found'
      });
    }

    if (!content && !emotion) {
      return res.status(400).json({
        success: false,
        error: 'Content or emotion is required'
      });
    }

    // Insert update
    const result = db.prepare(`
      INSERT INTO trade_updates (trade_id, update_type, content, emotion)
      VALUES (?, ?, ?, ?)
    `).run(trade.id, update_type, content || null, emotion || null);

    const update = db.prepare('SELECT * FROM trade_updates WHERE id = ?').get(result.lastInsertRowid);

    // Check for high-frequency updates (emotional flag)
    const recentUpdates = db.prepare(`
      SELECT COUNT(*) as count FROM trade_updates
      WHERE trade_id = ? AND created_at > datetime('now', '-30 minutes')
    `).get(trade.id);

    let warning = null;
    if (recentUpdates.count >= 3) {
      warning = `You've updated this trade ${recentUpdates.count} times in the last 30 minutes. Take a breath.`;
    }

    logger.info(`Trade update added: ${trade.trade_number}`);
    res.status(201).json({
      success: true,
      data: update,
      warning
    });
  } catch (error) {
    logger.error('Error adding trade update:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add trade update',
      message: error.message
    });
  }
});

/**
 * DELETE /api/trades/:id
 * Delete a trade (soft delete by marking as deleted, or hard delete)
 */
router.delete('/trades/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    // Find the trade
    const trade = db.prepare('SELECT * FROM trades WHERE id = ? OR trade_number = ?').get(id, id);

    if (!trade) {
      return res.status(404).json({
        success: false,
        error: 'Trade not found'
      });
    }

    // Delete associated updates first
    db.prepare('DELETE FROM trade_updates WHERE trade_id = ?').run(trade.id);

    // Delete the trade
    db.prepare('DELETE FROM trades WHERE id = ?').run(trade.id);

    logger.info(`Trade deleted: ${trade.trade_number}`);
    res.json({
      success: true,
      message: `Trade ${trade.trade_number} deleted successfully`
    });
  } catch (error) {
    logger.error('Error deleting trade:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete trade',
      message: error.message
    });
  }
});

module.exports = router;
