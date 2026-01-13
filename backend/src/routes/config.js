const express = require('express');
const configService = require('../services/configService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/config
 * Get all configuration
 */
router.get('/config', (req, res) => {
  try {
    const config = configService.getAllConfig();
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Error fetching config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configuration',
      message: error.message
    });
  }
});

/**
 * GET /api/config/:key
 * Get specific config value by key
 */
router.get('/config/:key', (req, res) => {
  try {
    const { key } = req.params;
    const value = configService.getConfig(key);

    if (value === null) {
      return res.status(404).json({
        success: false,
        error: 'Configuration key not found'
      });
    }

    res.json({
      success: true,
      data: { [key]: value }
    });
  } catch (error) {
    logger.error('Error fetching config key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configuration',
      message: error.message
    });
  }
});

/**
 * POST /api/config
 * Save configuration (single key or multiple keys)
 * Body: { key: "value" } or { key1: "value1", key2: "value2" }
 */
router.post('/config', (req, res) => {
  try {
    const configData = req.body;

    if (!configData || Object.keys(configData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No configuration data provided'
      });
    }

    // If single key provided, use setConfig, otherwise batch update
    const keys = Object.keys(configData);
    if (keys.length === 1) {
      const key = keys[0];
      const result = configService.setConfig(key, configData[key]);
      res.json({
        success: true,
        data: result
      });
    } else {
      const result = configService.setMultipleConfig(configData);
      res.json({
        success: true,
        data: result
      });
    }
  } catch (error) {
    logger.error('Error saving config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save configuration',
      message: error.message
    });
  }
});

/**
 * DELETE /api/config/:key
 * Delete configuration by key
 */
router.delete('/config/:key', (req, res) => {
  try {
    const { key } = req.params;
    const deleted = configService.deleteConfig(key);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Configuration key not found'
      });
    }

    res.json({
      success: true,
      message: `Configuration key '${key}' deleted successfully`
    });
  } catch (error) {
    logger.error('Error deleting config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete configuration',
      message: error.message
    });
  }
});

/**
 * POST /api/config/initialize
 * Initialize default configuration (idempotent)
 */
router.post('/config/initialize', (req, res) => {
  try {
    const initialized = configService.initializeDefaults();
    res.json({
      success: true,
      message: initialized ? 'Default configuration initialized' : 'Configuration already exists',
      initialized
    });
  } catch (error) {
    logger.error('Error initializing config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize configuration',
      message: error.message
    });
  }
});

module.exports = router;
