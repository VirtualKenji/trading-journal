const express = require('express');
const { getDatabase } = require('../db/database');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/export/csv
 * Export all trades as CSV
 */
router.get('/export/csv', (req, res) => {
  try {
    const db = getDatabase();
    const { from, to, status } = req.query;

    let whereClause = '1=1';
    const params = [];

    if (from) {
      whereClause += ' AND DATE(opened_at) >= ?';
      params.push(from);
    }
    if (to) {
      whereClause += ' AND DATE(opened_at) <= ?';
      params.push(to);
    }
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const trades = db.prepare(`
      SELECT * FROM trades
      WHERE ${whereClause}
      ORDER BY opened_at ASC
    `).all(...params);

    // Define CSV columns
    const columns = [
      'trade_number',
      'asset',
      'direction',
      'entry_price',
      'exit_price',
      'position_size',
      'leverage',
      'setup',
      'location',
      'trigger',
      'pnl',
      'pnl_percentage',
      'outcome',
      'initial_emotion',
      'planned_in_outlook',
      'status',
      'opened_at',
      'closed_at'
    ];

    // Build CSV content
    let csv = columns.join(',') + '\n';

    for (const trade of trades) {
      const row = columns.map(col => {
        let value = trade[col];
        if (value === null || value === undefined) {
          return '';
        }
        // Escape commas and quotes in string values
        if (typeof value === 'string') {
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            value = '"' + value.replace(/"/g, '""') + '"';
          }
        }
        return value;
      });
      csv += row.join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=trades_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);

    logger.info(`Exported ${trades.length} trades to CSV`);
  } catch (error) {
    logger.error('Error exporting CSV:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export CSV',
      message: error.message
    });
  }
});

/**
 * GET /api/export/json
 * Export all data as JSON (trades, trading_days, config)
 */
router.get('/export/json', (req, res) => {
  try {
    const db = getDatabase();
    const { from, to } = req.query;

    let tradesWhereClause = '1=1';
    let daysWhereClause = '1=1';
    const tradesParams = [];
    const daysParams = [];

    if (from) {
      tradesWhereClause += ' AND DATE(opened_at) >= ?';
      daysWhereClause += ' AND date >= ?';
      tradesParams.push(from);
      daysParams.push(from);
    }
    if (to) {
      tradesWhereClause += ' AND DATE(opened_at) <= ?';
      daysWhereClause += ' AND date <= ?';
      tradesParams.push(to);
      daysParams.push(to);
    }

    // Get trades with their updates
    const trades = db.prepare(`
      SELECT * FROM trades
      WHERE ${tradesWhereClause}
      ORDER BY opened_at ASC
    `).all(...tradesParams);

    // Add updates to each trade
    for (const trade of trades) {
      trade.updates = db.prepare(`
        SELECT * FROM trade_updates
        WHERE trade_id = ?
        ORDER BY created_at ASC
      `).all(trade.id);
    }

    // Get trading days
    const tradingDays = db.prepare(`
      SELECT * FROM trading_days
      WHERE ${daysWhereClause}
      ORDER BY date ASC
    `).all(...daysParams);

    // Parse JSON fields
    for (const day of tradingDays) {
      day.outlook_data = day.outlook_data ? JSON.parse(day.outlook_data) : null;
      day.review_data = day.review_data ? JSON.parse(day.review_data) : null;
    }

    // Get config
    const configRows = db.prepare('SELECT * FROM system_config').all();
    const config = {};
    for (const row of configRows) {
      try {
        config[row.key] = JSON.parse(row.value);
      } catch {
        config[row.key] = row.value;
      }
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      filters: { from, to },
      summary: {
        total_trades: trades.length,
        total_trading_days: tradingDays.length
      },
      trades,
      trading_days: tradingDays,
      config
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=trading_journal_${new Date().toISOString().split('T')[0]}.json`);
    res.json(exportData);

    logger.info(`Exported ${trades.length} trades and ${tradingDays.length} trading days to JSON`);
  } catch (error) {
    logger.error('Error exporting JSON:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export JSON',
      message: error.message
    });
  }
});

/**
 * GET /api/export/trades
 * Export trades as JSON array (simpler format)
 */
router.get('/export/trades', (req, res) => {
  try {
    const db = getDatabase();
    const { from, to, status, setup, location } = req.query;

    let whereClause = '1=1';
    const params = [];

    if (from) {
      whereClause += ' AND DATE(opened_at) >= ?';
      params.push(from);
    }
    if (to) {
      whereClause += ' AND DATE(opened_at) <= ?';
      params.push(to);
    }
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

    const trades = db.prepare(`
      SELECT * FROM trades
      WHERE ${whereClause}
      ORDER BY opened_at DESC
    `).all(...params);

    res.json({
      success: true,
      exported_at: new Date().toISOString(),
      count: trades.length,
      data: trades
    });
  } catch (error) {
    logger.error('Error exporting trades:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export trades',
      message: error.message
    });
  }
});

module.exports = router;
