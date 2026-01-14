const { getDatabase } = require('../db/database');

/**
 * Calculate win rate from trades
 * @param {Array} trades - Array of closed trades
 * @returns {number} Win rate as percentage (0-100)
 */
function calculateWinRate(trades) {
  const closedTrades = trades.filter(t => t.status === 'closed');
  if (closedTrades.length === 0) return 0;

  const wins = closedTrades.filter(t => t.outcome === 'win').length;
  return (wins / closedTrades.length) * 100;
}

/**
 * Calculate profit ratio (avg win / avg loss)
 * @param {Array} trades - Array of closed trades
 * @returns {number} Profit ratio (e.g., 2.1 means 2.1:1)
 */
function calculateProfitRatio(trades) {
  const wins = trades.filter(t => t.outcome === 'win' && t.pnl_percentage);
  const losses = trades.filter(t => t.outcome === 'loss' && t.pnl_percentage);

  if (wins.length === 0 || losses.length === 0) return null;

  const avgWin = wins.reduce((sum, t) => sum + Math.abs(t.pnl_percentage), 0) / wins.length;
  const avgLoss = losses.reduce((sum, t) => sum + Math.abs(t.pnl_percentage), 0) / losses.length;

  if (avgLoss === 0) return null;
  return avgWin / avgLoss;
}

/**
 * Calculate trade expectancy
 * @param {number} winRate - Win rate as percentage (0-100)
 * @param {number} profitRatio - Profit ratio
 * @returns {number} Expectancy value (positive = profitable)
 */
function calculateExpectancy(winRate, profitRatio) {
  if (winRate === null || profitRatio === null) return null;

  const winRateDecimal = winRate / 100;
  return (winRateDecimal * profitRatio) - ((1 - winRateDecimal) * 1);
}

/**
 * Get overall stats for all trades
 * @param {Object} filters - Optional filters (from, to)
 * @returns {Object} Overall statistics
 */
function getOverallStats(filters = {}) {
  const db = getDatabase();

  let whereClause = "status = 'closed'";
  const params = [];

  if (filters.from) {
    whereClause += ' AND DATE(closed_at) >= ?';
    params.push(filters.from);
  }
  if (filters.to) {
    whereClause += ' AND DATE(closed_at) <= ?';
    params.push(filters.to);
  }

  const trades = db.prepare(`SELECT * FROM trades WHERE ${whereClause}`).all(...params);

  const totalTrades = trades.length;
  const wins = trades.filter(t => t.outcome === 'win').length;
  const losses = trades.filter(t => t.outcome === 'loss').length;
  const breakeven = trades.filter(t => t.outcome === 'breakeven').length;

  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winRate = calculateWinRate(trades);
  const profitRatio = calculateProfitRatio(trades);
  const expectancy = calculateExpectancy(winRate, profitRatio);

  // Best and worst trades
  const bestTrade = trades.reduce((best, t) => (!best || (t.pnl || 0) > (best.pnl || 0)) ? t : best, null);
  const worstTrade = trades.reduce((worst, t) => (!worst || (t.pnl || 0) < (worst.pnl || 0)) ? t : worst, null);

  // Open trades count
  const openTrades = db.prepare("SELECT COUNT(*) as count FROM trades WHERE status = 'open'").get();

  return {
    total_trades: totalTrades,
    wins,
    losses,
    breakeven,
    open_trades: openTrades.count,
    win_rate: winRate,
    profit_ratio: profitRatio,
    expectancy,
    total_pnl: totalPnl,
    best_trade: bestTrade ? {
      trade_number: bestTrade.trade_number,
      pnl: bestTrade.pnl,
      pnl_percentage: bestTrade.pnl_percentage,
      setup: bestTrade.setup
    } : null,
    worst_trade: worstTrade ? {
      trade_number: worstTrade.trade_number,
      pnl: worstTrade.pnl,
      pnl_percentage: worstTrade.pnl_percentage,
      setup: worstTrade.setup
    } : null
  };
}

/**
 * Get stats grouped by a field (setup, location, etc.)
 * @param {string} groupBy - Field to group by
 * @param {Object} filters - Optional filters
 * @returns {Array} Stats per group
 */
function getStatsByField(groupBy, filters = {}) {
  const db = getDatabase();

  let whereClause = "status = 'closed'";
  const params = [];

  if (filters.from) {
    whereClause += ' AND DATE(closed_at) >= ?';
    params.push(filters.from);
  }
  if (filters.to) {
    whereClause += ' AND DATE(closed_at) <= ?';
    params.push(filters.to);
  }

  // Validate groupBy field
  const allowedFields = ['setup', 'location', 'trigger', 'direction', 'asset'];
  if (!allowedFields.includes(groupBy)) {
    throw new Error(`Invalid groupBy field: ${groupBy}`);
  }

  // Get all unique values for this field
  const groups = db.prepare(`
    SELECT DISTINCT ${groupBy} as value FROM trades
    WHERE ${whereClause} AND ${groupBy} IS NOT NULL
  `).all(...params);

  const results = [];

  for (const group of groups) {
    const groupParams = [...params, group.value];
    const trades = db.prepare(`
      SELECT * FROM trades
      WHERE ${whereClause} AND ${groupBy} = ?
    `).all(...groupParams);

    const totalTrades = trades.length;
    const wins = trades.filter(t => t.outcome === 'win').length;
    const losses = trades.filter(t => t.outcome === 'loss').length;
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winRate = calculateWinRate(trades);
    const profitRatio = calculateProfitRatio(trades);
    const expectancy = calculateExpectancy(winRate, profitRatio);

    results.push({
      [groupBy]: group.value,
      total_trades: totalTrades,
      wins,
      losses,
      win_rate: winRate,
      profit_ratio: profitRatio,
      expectancy,
      total_pnl: totalPnl
    });
  }

  // Sort by total trades descending
  return results.sort((a, b) => b.total_trades - a.total_trades);
}

/**
 * Get detailed stats for a specific setup
 * @param {string} setup - Setup name
 * @param {Object} filters - Optional filters
 * @returns {Object} Detailed stats for the setup
 */
function getSetupStats(setup, filters = {}) {
  const db = getDatabase();

  let whereClause = "status = 'closed' AND setup = ?";
  const params = [setup];

  if (filters.from) {
    whereClause += ' AND DATE(closed_at) >= ?';
    params.push(filters.from);
  }
  if (filters.to) {
    whereClause += ' AND DATE(closed_at) <= ?';
    params.push(filters.to);
  }

  const trades = db.prepare(`SELECT * FROM trades WHERE ${whereClause}`).all(...params);

  if (trades.length === 0) {
    return {
      setup,
      total_trades: 0,
      message: 'No closed trades found for this setup'
    };
  }

  const totalTrades = trades.length;
  const wins = trades.filter(t => t.outcome === 'win').length;
  const losses = trades.filter(t => t.outcome === 'loss').length;
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winRate = calculateWinRate(trades);
  const profitRatio = calculateProfitRatio(trades);
  const expectancy = calculateExpectancy(winRate, profitRatio);

  // Average position size
  const avgPositionSize = trades.reduce((sum, t) => sum + (t.position_size || 0), 0) / trades.length;

  // Stats by location for this setup
  const locationStats = {};
  for (const trade of trades) {
    if (!trade.location) continue;
    if (!locationStats[trade.location]) {
      locationStats[trade.location] = { total: 0, wins: 0, pnl: 0 };
    }
    locationStats[trade.location].total++;
    if (trade.outcome === 'win') locationStats[trade.location].wins++;
    locationStats[trade.location].pnl += trade.pnl || 0;
  }

  // Convert to array and add win rate
  const locationBreakdown = Object.entries(locationStats).map(([location, stats]) => ({
    location,
    total_trades: stats.total,
    wins: stats.wins,
    win_rate: (stats.wins / stats.total) * 100,
    total_pnl: stats.pnl
  })).sort((a, b) => b.total_trades - a.total_trades);

  // Recent trades
  const recentTrades = trades
    .sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at))
    .slice(0, 5)
    .map(t => ({
      trade_number: t.trade_number,
      outcome: t.outcome,
      pnl: t.pnl,
      pnl_percentage: t.pnl_percentage,
      location: t.location,
      closed_at: t.closed_at
    }));

  return {
    setup,
    total_trades: totalTrades,
    wins,
    losses,
    win_rate: winRate,
    profit_ratio: profitRatio,
    expectancy,
    total_pnl: totalPnl,
    avg_position_size: avgPositionSize,
    location_breakdown: locationBreakdown,
    recent_trades: recentTrades
  };
}

/**
 * Get emotion correlation stats
 * @param {Object} filters - Optional filters
 * @returns {Array} Stats by emotion
 */
function getEmotionStats(filters = {}) {
  const db = getDatabase();

  let whereClause = "status = 'closed' AND initial_emotion IS NOT NULL";
  const params = [];

  if (filters.from) {
    whereClause += ' AND DATE(closed_at) >= ?';
    params.push(filters.from);
  }
  if (filters.to) {
    whereClause += ' AND DATE(closed_at) <= ?';
    params.push(filters.to);
  }

  const emotions = db.prepare(`
    SELECT DISTINCT initial_emotion as emotion FROM trades
    WHERE ${whereClause}
  `).all(...params);

  const results = [];

  for (const { emotion } of emotions) {
    const emotionParams = [...params, emotion];
    const trades = db.prepare(`
      SELECT * FROM trades
      WHERE ${whereClause} AND initial_emotion = ?
    `).all(...emotionParams);

    const totalTrades = trades.length;
    const wins = trades.filter(t => t.outcome === 'win').length;
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winRate = calculateWinRate(trades);

    results.push({
      emotion,
      total_trades: totalTrades,
      wins,
      win_rate: winRate,
      total_pnl: totalPnl
    });
  }

  return results.sort((a, b) => b.total_trades - a.total_trades);
}

module.exports = {
  calculateWinRate,
  calculateProfitRatio,
  calculateExpectancy,
  getOverallStats,
  getStatsByField,
  getSetupStats,
  getEmotionStats
};
