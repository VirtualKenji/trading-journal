const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDatabase } = require('../db/database');
const { extractTradeData, mapToTradeFields } = require('../services/screenshotService');
const { generateTradeNumber, getTodayDate } = require('../services/tradeNumbering');
const { detectSession } = require('../services/sessionDetection');
const logger = require('../utils/logger');

const router = express.Router();

// Configure upload directory
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads/screenshots');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `screenshot-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPEG, WebP, and GIF are allowed.'));
    }
  }
});

/**
 * POST /api/screenshots/extract
 * Upload a screenshot and extract trade data (without saving to DB)
 */
router.post('/screenshots/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const result = await extractTradeData(req.file.path);

    if (!result.success) {
      // Clean up uploaded file on failure
      fs.unlinkSync(req.file.path);
      return res.status(422).json({
        success: false,
        error: 'Failed to extract trade data',
        message: result.error
      });
    }

    // Clean up the temp file after extraction
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      extracted_data: result.data,
      trade_fields: mapToTradeFields(result.data)
    });

  } catch (error) {
    logger.error('Error in screenshot extraction:', error);
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      error: 'Failed to process screenshot',
      message: error.message
    });
  }
});

/**
 * POST /api/screenshots
 * Upload a screenshot and link to an entity
 */
router.post('/screenshots', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { entity_type, entity_id, extract = 'true' } = req.body;

    if (!entity_type || !entity_id) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'entity_type and entity_id are required'
      });
    }

    // Extract data if requested
    let extractedData = null;
    if (extract === 'true') {
      const result = await extractTradeData(req.file.path);
      if (result.success) {
        extractedData = result.data;
      }
    }

    // Save to database
    const db = getDatabase();
    const relativePath = path.relative(path.join(__dirname, '../..'), req.file.path);

    const stmt = db.prepare(`
      INSERT INTO screenshots (entity_type, entity_id, file_path, extracted_data)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      entity_type,
      parseInt(entity_id),
      relativePath,
      extractedData ? JSON.stringify(extractedData) : null
    );

    const screenshot = db.prepare('SELECT * FROM screenshots WHERE id = ?').get(result.lastInsertRowid);

    // Parse JSON for response
    if (screenshot.extracted_data) {
      screenshot.extracted_data = JSON.parse(screenshot.extracted_data);
    }

    logger.info(`Screenshot uploaded: ${relativePath} for ${entity_type}:${entity_id}`);
    res.status(201).json({
      success: true,
      data: screenshot
    });

  } catch (error) {
    logger.error('Error uploading screenshot:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      error: 'Failed to upload screenshot',
      message: error.message
    });
  }
});

/**
 * GET /api/screenshots
 * List screenshots for an entity
 */
router.get('/screenshots', (req, res) => {
  try {
    const db = getDatabase();
    const { entity_type, entity_id } = req.query;

    let whereClause = '1=1';
    const params = [];

    if (entity_type) {
      whereClause += ' AND entity_type = ?';
      params.push(entity_type);
    }
    if (entity_id) {
      whereClause += ' AND entity_id = ?';
      params.push(parseInt(entity_id));
    }

    const screenshots = db.prepare(`
      SELECT * FROM screenshots
      WHERE ${whereClause}
      ORDER BY uploaded_at DESC
    `).all(...params);

    // Parse JSON fields
    screenshots.forEach(s => {
      if (s.extracted_data) {
        s.extracted_data = JSON.parse(s.extracted_data);
      }
    });

    res.json({
      success: true,
      data: screenshots
    });

  } catch (error) {
    logger.error('Error fetching screenshots:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch screenshots',
      message: error.message
    });
  }
});

/**
 * DELETE /api/screenshots/:id
 * Delete a screenshot
 */
router.delete('/screenshots/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const screenshot = db.prepare('SELECT * FROM screenshots WHERE id = ?').get(id);

    if (!screenshot) {
      return res.status(404).json({
        success: false,
        error: 'Screenshot not found'
      });
    }

    // Delete file from disk
    const fullPath = path.join(__dirname, '../..', screenshot.file_path);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // Delete from database
    db.prepare('DELETE FROM screenshots WHERE id = ?').run(id);

    logger.info(`Screenshot deleted: ${screenshot.file_path}`);
    res.json({
      success: true,
      message: 'Screenshot deleted'
    });

  } catch (error) {
    logger.error('Error deleting screenshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete screenshot',
      message: error.message
    });
  }
});

/**
 * POST /api/screenshots/:id/reprocess
 * Re-run extraction on an existing screenshot
 */
router.post('/screenshots/:id/reprocess', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const screenshot = db.prepare('SELECT * FROM screenshots WHERE id = ?').get(id);

    if (!screenshot) {
      return res.status(404).json({
        success: false,
        error: 'Screenshot not found'
      });
    }

    const fullPath = path.join(__dirname, '../..', screenshot.file_path);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        error: 'Screenshot file not found on disk'
      });
    }

    const result = await extractTradeData(fullPath);

    if (!result.success) {
      return res.status(422).json({
        success: false,
        error: 'Failed to extract trade data',
        message: result.error
      });
    }

    // Update database
    db.prepare(`
      UPDATE screenshots SET extracted_data = ? WHERE id = ?
    `).run(JSON.stringify(result.data), id);

    const updated = db.prepare('SELECT * FROM screenshots WHERE id = ?').get(id);
    updated.extracted_data = JSON.parse(updated.extracted_data);

    logger.info(`Screenshot reprocessed: ${screenshot.file_path}`);
    res.json({
      success: true,
      data: updated
    });

  } catch (error) {
    logger.error('Error reprocessing screenshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reprocess screenshot',
      message: error.message
    });
  }
});

/**
 * POST /api/trades/from-screenshot
 * Create a new trade from a screenshot
 */
router.post('/trades/from-screenshot', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Extract trade data
    const result = await extractTradeData(req.file.path);

    if (!result.success) {
      fs.unlinkSync(req.file.path);
      return res.status(422).json({
        success: false,
        error: 'Failed to extract trade data',
        message: result.error
      });
    }

    const extracted = result.data;
    const tradeFields = mapToTradeFields(extracted);

    // Validate required fields
    if (!tradeFields.asset || !tradeFields.direction) {
      fs.unlinkSync(req.file.path);
      return res.status(422).json({
        success: false,
        error: 'Could not extract required fields (asset, direction) from screenshot'
      });
    }

    const db = getDatabase();

    // Generate trade number and detect session
    const today = getTodayDate();
    const trade_number = generateTradeNumber(today);
    const opened_at = new Date().toISOString();
    const session = detectSession(opened_at);

    // Get or create trading day
    let tradingDay = db.prepare('SELECT id FROM trading_days WHERE date = ?').get(today);
    if (!tradingDay) {
      const dayResult = db.prepare('INSERT INTO trading_days (date) VALUES (?)').run(today);
      tradingDay = { id: dayResult.lastInsertRowid };
    }

    // Insert trade
    const stmt = db.prepare(`
      INSERT INTO trades (
        trade_number, trading_day_id, asset, direction, entry_price,
        position_size, collateral, leverage, liquidation_price,
        session, status, opened_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `);

    const tradeResult = stmt.run(
      trade_number,
      tradingDay.id,
      tradeFields.asset,
      tradeFields.direction,
      tradeFields.entry_price,
      tradeFields.position_size,
      tradeFields.collateral,
      tradeFields.leverage,
      tradeFields.liquidation_price,
      session,
      opened_at
    );

    const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeResult.lastInsertRowid);

    // Save screenshot and link to trade
    const relativePath = path.relative(path.join(__dirname, '../..'), req.file.path);
    db.prepare(`
      INSERT INTO screenshots (entity_type, entity_id, file_path, extracted_data)
      VALUES ('trade', ?, ?, ?)
    `).run(trade.id, relativePath, JSON.stringify(extracted));

    logger.info(`Trade created from screenshot: ${trade_number} - ${tradeFields.asset} ${tradeFields.direction}`);
    res.status(201).json({
      success: true,
      data: trade,
      extracted_data: extracted,
      message: `Trade ${trade_number} created from screenshot`
    });

  } catch (error) {
    logger.error('Error creating trade from screenshot:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create trade from screenshot',
      message: error.message
    });
  }
});

/**
 * PUT /api/trades/:id/from-screenshot
 * Update an existing trade from a screenshot
 */
router.put('/trades/:id/from-screenshot', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const db = getDatabase();
    const { id } = req.params;

    // Find the trade
    const trade = db.prepare('SELECT * FROM trades WHERE id = ? OR trade_number = ?').get(id, id);

    if (!trade) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        error: 'Trade not found'
      });
    }

    // Extract trade data
    const result = await extractTradeData(req.file.path);

    if (!result.success) {
      fs.unlinkSync(req.file.path);
      return res.status(422).json({
        success: false,
        error: 'Failed to extract trade data',
        message: result.error
      });
    }

    const extracted = result.data;
    const tradeFields = mapToTradeFields(extracted);

    // Update trade with extracted fields (only non-null values)
    const updates = [];
    const params = [];

    if (tradeFields.entry_price !== null) {
      updates.push('entry_price = ?');
      params.push(tradeFields.entry_price);
    }
    if (tradeFields.position_size !== null) {
      updates.push('position_size = ?');
      params.push(tradeFields.position_size);
    }
    if (tradeFields.collateral !== null) {
      updates.push('collateral = ?');
      params.push(tradeFields.collateral);
    }
    if (tradeFields.leverage !== null) {
      updates.push('leverage = ?');
      params.push(tradeFields.leverage);
    }
    if (tradeFields.liquidation_price !== null) {
      updates.push('liquidation_price = ?');
      params.push(tradeFields.liquidation_price);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(trade.id);

      db.prepare(`UPDATE trades SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    // Save screenshot and link to trade
    const relativePath = path.relative(path.join(__dirname, '../..'), req.file.path);
    db.prepare(`
      INSERT INTO screenshots (entity_type, entity_id, file_path, extracted_data)
      VALUES ('trade', ?, ?, ?)
    `).run(trade.id, relativePath, JSON.stringify(extracted));

    const updatedTrade = db.prepare('SELECT * FROM trades WHERE id = ?').get(trade.id);

    logger.info(`Trade updated from screenshot: ${trade.trade_number}`);
    res.json({
      success: true,
      data: updatedTrade,
      extracted_data: extracted,
      message: `Trade ${trade.trade_number} updated from screenshot`
    });

  } catch (error) {
    logger.error('Error updating trade from screenshot:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      error: 'Failed to update trade from screenshot',
      message: error.message
    });
  }
});

module.exports = router;
