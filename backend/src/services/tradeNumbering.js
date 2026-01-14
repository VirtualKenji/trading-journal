const { getDatabase } = require('../db/database');

/**
 * Generate the next trade number for a given date
 * Format: YYYY-MM-DD-T{sequence}
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {string} Trade number (e.g., "2026-01-14-T1")
 */
function generateTradeNumber(date) {
  const db = getDatabase();

  // Find the highest sequence number for this date
  const pattern = `${date}-T%`;
  const result = db.prepare(`
    SELECT trade_number FROM trades
    WHERE trade_number LIKE ?
    ORDER BY trade_number DESC
    LIMIT 1
  `).get(pattern);

  let sequence = 1;
  if (result) {
    // Extract the sequence number from the last trade
    const match = result.trade_number.match(/-T(\d+)$/);
    if (match) {
      sequence = parseInt(match[1], 10) + 1;
    }
  }

  return `${date}-T${sequence}`;
}

/**
 * Get the date portion of a trade number
 * @param {string} tradeNumber - Trade number (e.g., "2026-01-14-T1")
 * @returns {string} Date in YYYY-MM-DD format
 */
function getDateFromTradeNumber(tradeNumber) {
  const match = tradeNumber.match(/^(\d{4}-\d{2}-\d{2})-T\d+$/);
  return match ? match[1] : null;
}

/**
 * Validate trade number format
 * @param {string} tradeNumber - Trade number to validate
 * @returns {boolean} True if valid format
 */
function isValidTradeNumber(tradeNumber) {
  return /^\d{4}-\d{2}-\d{2}-T\d+$/.test(tradeNumber);
}

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string} Today's date
 */
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

module.exports = {
  generateTradeNumber,
  getDateFromTradeNumber,
  isValidTradeNumber,
  getTodayDate
};
