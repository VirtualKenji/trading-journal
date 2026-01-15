require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });
const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('./utils/logger');
const { initializeDatabase } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
const healthRouter = require('./routes/health');
const configRouter = require('./routes/config');
const tradesRouter = require('./routes/trades');
const tradingDaysRouter = require('./routes/trading-days');
const statsRouter = require('./routes/stats');
const exportRouter = require('./routes/export');
const lessonsRouter = require('./routes/lessons');

app.use('/api', healthRouter);
app.use('/api', configRouter);
app.use('/api', tradesRouter);
app.use('/api', tradingDaysRouter);
app.use('/api', statsRouter);
app.use('/api', exportRouter);
app.use('/api', lessonsRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Trading Journal API',
    version: '0.1.0',
    status: 'running',
    docs: '/api/health'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Initialize database and start server
initializeDatabase();

// Initialize default configuration
const configService = require('./services/configService');
const initialized = configService.initializeDefaults();
if (initialized) {
  logger.info('✓ Default configuration initialized');
}

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Database: ${process.env.DB_PATH || './data/trading.db'}`);
});

module.exports = app;
