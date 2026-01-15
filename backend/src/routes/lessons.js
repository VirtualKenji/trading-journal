const express = require('express');
const { getDatabase } = require('../db/database');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/lesson-categories
 * List all lesson categories (hierarchical)
 */
router.get('/lesson-categories', (req, res) => {
  try {
    const db = getDatabase();
    const categories = db.prepare(`
      SELECT * FROM lesson_categories
      ORDER BY sort_order, name
    `).all();

    // Build hierarchical structure
    const rootCategories = categories.filter(c => !c.parent_id);
    const buildTree = (parent) => {
      return {
        ...parent,
        children: categories
          .filter(c => c.parent_id === parent.id)
          .map(buildTree)
      };
    };

    const tree = rootCategories.map(buildTree);

    res.json({
      success: true,
      data: tree,
      flat: categories
    });
  } catch (error) {
    logger.error('Error fetching lesson categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lesson categories',
      message: error.message
    });
  }
});

/**
 * POST /api/lessons
 * Create a new lesson
 */
router.post('/lessons', (req, res) => {
  try {
    const db = getDatabase();
    const {
      title,
      content,
      category_id,
      conditions,
      learned_at
    } = req.body;

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and content are required'
      });
    }

    const learnedDate = learned_at || new Date().toISOString().split('T')[0];

    // Calculate stats snapshot for the conditions at time of lesson creation
    let statsSnapshot = null;
    let tradeCountBefore = 0;

    if (conditions) {
      const stats = calculateConditionStats(db, conditions);
      statsSnapshot = JSON.stringify(stats);
      tradeCountBefore = stats.total_trades || 0;
    }

    const stmt = db.prepare(`
      INSERT INTO lessons (
        title, content, category_id, conditions, learned_at,
        stats_before, trade_count_before, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `);

    const result = stmt.run(
      title,
      content,
      category_id || null,
      conditions ? JSON.stringify(conditions) : null,
      learnedDate,
      statsSnapshot,
      tradeCountBefore
    );

    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(result.lastInsertRowid);

    // Parse JSON fields for response
    if (lesson.conditions) lesson.conditions = JSON.parse(lesson.conditions);
    if (lesson.stats_before) lesson.stats_before = JSON.parse(lesson.stats_before);

    logger.info(`Lesson created: ${title}`);
    res.status(201).json({
      success: true,
      data: lesson,
      message: `Lesson "${title}" created. Tracking performance from ${learnedDate}.`
    });
  } catch (error) {
    logger.error('Error creating lesson:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create lesson',
      message: error.message
    });
  }
});

/**
 * GET /api/lessons
 * List lessons with optional filters
 */
router.get('/lessons', (req, res) => {
  try {
    const db = getDatabase();
    const { category_id, status, search, limit = 50, offset = 0 } = req.query;

    let whereClause = '1=1';
    const params = [];

    if (category_id) {
      whereClause += ' AND category_id = ?';
      params.push(category_id);
    }
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    if (search) {
      whereClause += ' AND (title LIKE ? OR content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as count FROM lessons WHERE ${whereClause}`).get(...params);

    params.push(parseInt(limit), parseInt(offset));
    const lessons = db.prepare(`
      SELECT l.*, lc.name as category_name
      FROM lessons l
      LEFT JOIN lesson_categories lc ON l.category_id = lc.id
      WHERE ${whereClause}
      ORDER BY l.learned_at DESC
      LIMIT ? OFFSET ?
    `).all(...params);

    // Parse JSON fields
    lessons.forEach(lesson => {
      if (lesson.conditions) lesson.conditions = JSON.parse(lesson.conditions);
      if (lesson.stats_before) lesson.stats_before = JSON.parse(lesson.stats_before);
      if (lesson.stats_after) lesson.stats_after = JSON.parse(lesson.stats_after);
    });

    res.json({
      success: true,
      data: lessons,
      meta: {
        total: countResult.count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    logger.error('Error fetching lessons:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lessons',
      message: error.message
    });
  }
});

/**
 * GET /api/lessons/relevant
 * Get lessons relevant to current trade context
 */
router.get('/lessons/relevant', (req, res) => {
  try {
    const db = getDatabase();
    const { setup, session, trigger, emotion, location } = req.query;

    // Get all active lessons with conditions
    const lessons = db.prepare(`
      SELECT l.*, lc.name as category_name
      FROM lessons l
      LEFT JOIN lesson_categories lc ON l.category_id = lc.id
      WHERE l.status = 'active' AND l.conditions IS NOT NULL
    `).all();

    // Score each lesson by how well it matches the context
    const scoredLessons = lessons.map(lesson => {
      const conditions = JSON.parse(lesson.conditions);
      let score = 0;
      let matches = [];

      if (setup && conditions.setup?.includes(setup)) {
        score += 3;
        matches.push('setup');
      }
      if (session && conditions.session?.includes(session)) {
        score += 2;
        matches.push('session');
      }
      if (trigger && conditions.trigger?.includes(trigger)) {
        score += 3;
        matches.push('trigger');
      }
      if (emotion && conditions.emotion?.includes(emotion)) {
        score += 2;
        matches.push('emotion');
      }
      if (location && conditions.location?.includes(location)) {
        score += 2;
        matches.push('location');
      }

      return {
        ...lesson,
        conditions,
        relevance_score: score,
        matched_on: matches
      };
    });

    // Filter to only matching lessons, sort by score
    const relevant = scoredLessons
      .filter(l => l.relevance_score > 0)
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 5);

    res.json({
      success: true,
      data: relevant,
      context: { setup, session, trigger, emotion, location }
    });
  } catch (error) {
    logger.error('Error fetching relevant lessons:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch relevant lessons',
      message: error.message
    });
  }
});

/**
 * GET /api/lessons/:id
 * Get a single lesson with stats
 */
router.get('/lessons/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const lesson = db.prepare(`
      SELECT l.*, lc.name as category_name
      FROM lessons l
      LEFT JOIN lesson_categories lc ON l.category_id = lc.id
      WHERE l.id = ?
    `).get(id);

    if (!lesson) {
      return res.status(404).json({
        success: false,
        error: 'Lesson not found'
      });
    }

    // Parse JSON fields
    if (lesson.conditions) lesson.conditions = JSON.parse(lesson.conditions);
    if (lesson.stats_before) lesson.stats_before = JSON.parse(lesson.stats_before);
    if (lesson.stats_after) lesson.stats_after = JSON.parse(lesson.stats_after);

    // Calculate current stats if conditions exist
    let currentStats = null;
    if (lesson.conditions) {
      currentStats = calculateConditionStats(db, lesson.conditions, lesson.learned_at);
    }

    res.json({
      success: true,
      data: {
        ...lesson,
        current_stats: currentStats
      }
    });
  } catch (error) {
    logger.error('Error fetching lesson:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lesson',
      message: error.message
    });
  }
});

/**
 * PUT /api/lessons/:id
 * Update a lesson
 */
router.put('/lessons/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const updates = req.body;

    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(id);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        error: 'Lesson not found'
      });
    }

    const allowedFields = ['title', 'content', 'category_id', 'conditions', 'status', 'validation_note'];
    const setClauses = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = ?`);
        if (key === 'conditions' && typeof value === 'object') {
          params.push(JSON.stringify(value));
        } else {
          params.push(value);
        }
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
    params.push(id);

    db.prepare(`UPDATE lessons SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);

    const updatedLesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(id);

    // Parse JSON fields
    if (updatedLesson.conditions) updatedLesson.conditions = JSON.parse(updatedLesson.conditions);
    if (updatedLesson.stats_before) updatedLesson.stats_before = JSON.parse(updatedLesson.stats_before);
    if (updatedLesson.stats_after) updatedLesson.stats_after = JSON.parse(updatedLesson.stats_after);

    logger.info(`Lesson updated: ${updatedLesson.title}`);
    res.json({
      success: true,
      data: updatedLesson
    });
  } catch (error) {
    logger.error('Error updating lesson:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update lesson',
      message: error.message
    });
  }
});

/**
 * DELETE /api/lessons/:id
 * Archive a lesson (soft delete)
 */
router.delete('/lessons/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(id);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        error: 'Lesson not found'
      });
    }

    // Soft delete - mark as archived
    db.prepare(`
      UPDATE lessons SET status = 'archived', updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), id);

    logger.info(`Lesson archived: ${lesson.title}`);
    res.json({
      success: true,
      message: `Lesson "${lesson.title}" archived`
    });
  } catch (error) {
    logger.error('Error archiving lesson:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive lesson',
      message: error.message
    });
  }
});

/**
 * POST /api/lessons/:id/validate
 * Trigger validation check for a lesson
 */
router.post('/lessons/:id/validate', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(id);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        error: 'Lesson not found'
      });
    }

    if (!lesson.conditions) {
      return res.status(400).json({
        success: false,
        error: 'Lesson has no conditions to validate'
      });
    }

    const conditions = JSON.parse(lesson.conditions);
    const statsBefore = lesson.stats_before ? JSON.parse(lesson.stats_before) : null;

    // Calculate current stats for matching conditions since lesson was learned
    const statsAfter = calculateConditionStats(db, conditions, lesson.learned_at);

    // Determine validation status
    let newStatus = lesson.status;
    let validationNote = '';

    if (statsAfter.total_trades >= 5) {
      if (statsBefore && statsBefore.win_rate !== undefined) {
        const winRateDelta = statsAfter.win_rate - statsBefore.win_rate;

        if (winRateDelta >= 10) {
          newStatus = 'validated';
          validationNote = `Win rate improved by ${winRateDelta.toFixed(1)}% (${statsBefore.win_rate.toFixed(1)}% → ${statsAfter.win_rate.toFixed(1)}%)`;
        } else if (winRateDelta <= -10) {
          newStatus = 'invalidated';
          validationNote = `Win rate decreased by ${Math.abs(winRateDelta).toFixed(1)}% (${statsBefore.win_rate.toFixed(1)}% → ${statsAfter.win_rate.toFixed(1)}%)`;
        } else {
          validationNote = `Win rate change: ${winRateDelta >= 0 ? '+' : ''}${winRateDelta.toFixed(1)}% (not significant yet)`;
        }
      }
    } else {
      validationNote = `Need ${5 - statsAfter.total_trades} more matching trades to validate`;
    }

    // Update lesson with new stats
    db.prepare(`
      UPDATE lessons SET
        stats_after = ?,
        trade_count_after = ?,
        status = ?,
        validation_note = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(statsAfter),
      statsAfter.total_trades,
      newStatus,
      validationNote,
      new Date().toISOString(),
      id
    );

    const updatedLesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(id);

    res.json({
      success: true,
      data: {
        lesson_id: id,
        status: newStatus,
        validation_note: validationNote,
        stats_before: statsBefore,
        stats_after: statsAfter,
        trade_count_after: statsAfter.total_trades
      },
      message: validationNote
    });
  } catch (error) {
    logger.error('Error validating lesson:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate lesson',
      message: error.message
    });
  }
});

/**
 * Calculate stats for trades matching conditions
 * @param {Database} db - Database instance
 * @param {Object} conditions - Conditions to match
 * @param {string} afterDate - Only count trades after this date (optional)
 */
function calculateConditionStats(db, conditions, afterDate = null) {
  let whereClause = "status = 'closed'";
  const params = [];

  if (conditions.setup?.length > 0) {
    whereClause += ` AND setup IN (${conditions.setup.map(() => '?').join(',')})`;
    params.push(...conditions.setup);
  }
  if (conditions.session?.length > 0) {
    whereClause += ` AND session IN (${conditions.session.map(() => '?').join(',')})`;
    params.push(...conditions.session);
  }
  if (conditions.trigger?.length > 0) {
    whereClause += ` AND trigger IN (${conditions.trigger.map(() => '?').join(',')})`;
    params.push(...conditions.trigger);
  }
  if (conditions.location?.length > 0) {
    whereClause += ` AND location IN (${conditions.location.map(() => '?').join(',')})`;
    params.push(...conditions.location);
  }
  if (conditions.emotion?.length > 0) {
    whereClause += ` AND initial_emotion IN (${conditions.emotion.map(() => '?').join(',')})`;
    params.push(...conditions.emotion);
  }

  if (afterDate) {
    whereClause += ' AND DATE(closed_at) >= ?';
    params.push(afterDate);
  }

  const trades = db.prepare(`SELECT * FROM trades WHERE ${whereClause}`).all(...params);

  const wins = trades.filter(t => t.outcome === 'win').length;
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

  return {
    total_trades: trades.length,
    wins,
    losses: trades.filter(t => t.outcome === 'loss').length,
    win_rate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    total_pnl: totalPnl,
    avg_pnl: trades.length > 0 ? totalPnl / trades.length : 0
  };
}

module.exports = router;
