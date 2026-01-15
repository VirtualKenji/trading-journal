/**
 * Trading Session Detection Service
 *
 * Detects trading session based on UTC time.
 * Sessions are defined for crypto/forex markets.
 */

// Session definitions in UTC hours
const SESSIONS = {
  'Asia': { start: 0, end: 7 },
  'London': { start: 7, end: 12 },
  'Pre-NY': { start: 12, end: 14.5 },
  'NY Open': { start: 14.5, end: 16 },
  'NY Session': { start: 16, end: 21 },
  'After Hours': { start: 21, end: 24 }
};

/**
 * Detect trading session from ISO timestamp
 * @param {string} isoTimestamp - ISO 8601 timestamp
 * @returns {string} Session name
 */
function detectSession(isoTimestamp) {
  const date = new Date(isoTimestamp);
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const time = hour + minute / 60;

  // Priority order: most specific sessions first
  if (time >= 14.5 && time < 16) return 'NY Open';
  if (time >= 12 && time < 14.5) return 'Pre-NY';
  if (time >= 7 && time < 12) return 'London';
  if (time >= 0 && time < 7) return 'Asia';
  if (time >= 16 && time < 21) return 'NY Session';
  return 'After Hours';
}

/**
 * Get all session names
 * @returns {string[]} Array of session names
 */
function getAllSessions() {
  return Object.keys(SESSIONS);
}

/**
 * Get session time range in UTC
 * @param {string} sessionName - Name of the session
 * @returns {object|null} Session time range or null if not found
 */
function getSessionTimeRange(sessionName) {
  return SESSIONS[sessionName] || null;
}

module.exports = {
  detectSession,
  getAllSessions,
  getSessionTimeRange,
  SESSIONS
};
