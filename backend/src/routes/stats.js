const express = require('express');
const statsService = require('../services/statsService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/stats/overview
 * Get overall trading statistics
 * Query params: from, to (date filters)
 */
router.get('/stats/overview', (req, res) => {
  try {
    const { from, to } = req.query;
    const stats = statsService.getOverallStats({ from, to });

    res.json({
      success: true,
      data: stats,
      filters: { from, to }
    });
  } catch (error) {
    logger.error('Error fetching overview stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/stats/by-setup
 * Get statistics grouped by setup
 */
router.get('/stats/by-setup', (req, res) => {
  try {
    const { from, to } = req.query;
    const stats = statsService.getStatsByField('setup', { from, to });

    res.json({
      success: true,
      data: stats,
      filters: { from, to }
    });
  } catch (error) {
    logger.error('Error fetching stats by setup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/stats/by-location
 * Get statistics grouped by location
 */
router.get('/stats/by-location', (req, res) => {
  try {
    const { from, to } = req.query;
    const stats = statsService.getStatsByField('location', { from, to });

    res.json({
      success: true,
      data: stats,
      filters: { from, to }
    });
  } catch (error) {
    logger.error('Error fetching stats by location:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/stats/by-trigger
 * Get statistics grouped by trigger
 */
router.get('/stats/by-trigger', (req, res) => {
  try {
    const { from, to } = req.query;
    const stats = statsService.getStatsByField('trigger', { from, to });

    res.json({
      success: true,
      data: stats,
      filters: { from, to }
    });
  } catch (error) {
    logger.error('Error fetching stats by trigger:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/stats/by-direction
 * Get statistics grouped by direction (long/short)
 */
router.get('/stats/by-direction', (req, res) => {
  try {
    const { from, to } = req.query;
    const stats = statsService.getStatsByField('direction', { from, to });

    res.json({
      success: true,
      data: stats,
      filters: { from, to }
    });
  } catch (error) {
    logger.error('Error fetching stats by direction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/stats/by-session
 * Get statistics grouped by trading session (Asia, London, Pre-NY, NY Open, NY Session, After Hours)
 */
router.get('/stats/by-session', (req, res) => {
  try {
    const { from, to } = req.query;
    const stats = statsService.getStatsByField('session', { from, to });

    res.json({
      success: true,
      data: stats,
      filters: { from, to }
    });
  } catch (error) {
    logger.error('Error fetching stats by session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/stats/setup/:name
 * Get detailed statistics for a specific setup
 */
router.get('/stats/setup/:name', (req, res) => {
  try {
    const { name } = req.params;
    const { from, to } = req.query;
    const stats = statsService.getSetupStats(name, { from, to });

    res.json({
      success: true,
      data: stats,
      filters: { from, to }
    });
  } catch (error) {
    logger.error('Error fetching setup stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/stats/emotions
 * Get statistics correlated with entry emotions
 */
router.get('/stats/emotions', (req, res) => {
  try {
    const { from, to } = req.query;
    const stats = statsService.getEmotionStats({ from, to });

    res.json({
      success: true,
      data: stats,
      filters: { from, to }
    });
  } catch (error) {
    logger.error('Error fetching emotion stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

module.exports = router;
