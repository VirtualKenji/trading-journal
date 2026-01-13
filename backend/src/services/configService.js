const { getDatabase } = require('../db/database');

class ConfigService {
  /**
   * Get single config value by key
   */
  getConfig(key) {
    const db = getDatabase();
    const row = db.prepare('SELECT value FROM system_config WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : null;
  }

  /**
   * Get all config as object
   */
  getAllConfig() {
    const db = getDatabase();
    const rows = db.prepare('SELECT key, value FROM system_config').all();
    const config = {};
    rows.forEach(row => {
      config[row.key] = JSON.parse(row.value);
    });
    return config;
  }

  /**
   * Set single config value (upsert)
   */
  setConfig(key, value) {
    const db = getDatabase();
    const valueJson = JSON.stringify(value);

    db.prepare(`
      INSERT INTO system_config (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `).run(key, valueJson);

    return { key, value };
  }

  /**
   * Set multiple config values (batch upsert)
   */
  setMultipleConfig(configObject) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO system_config (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);

    const transaction = db.transaction((configs) => {
      for (const [key, value] of Object.entries(configs)) {
        stmt.run(key, JSON.stringify(value));
      }
    });

    transaction(configObject);
    return configObject;
  }

  /**
   * Delete config by key
   */
  deleteConfig(key) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM system_config WHERE key = ?').run(key);
    return result.changes > 0;
  }

  /**
   * Initialize default configuration
   */
  initializeDefaults() {
    const defaults = {
      setup_completed: false,
      trading_style: {
        name: "VWAP-Based Mean Reversion & Breakout",
        description: "Focus on VWAP levels (daily, weekly, monthly, quarterly, yearly) combined with volume analysis, clinic trends, and orderflow triggers."
      },
      setups: [
        "Breakout",
        "Breakdown",
        "Mean Reversion",
        "CME Gap Fills",
        "Mean to Edge",
        "FOMO"
      ],
      locations: [
        // Daily VWAP levels
        "dVWAP VAH 2SD", "dVWAP VAH", "dVWAP", "dVWAP VAL", "dVWAP VAL 2SD",
        // Weekly VWAP levels
        "wVWAP VAH 2SD", "wVWAP VAH", "wVWAP", "wVWAP VAL", "wVWAP VAL 2SD",
        // Monthly VWAP levels
        "mVWAP VAH 2SD", "mVWAP VAH", "mVWAP", "mVWAP VAL", "mVWAP VAL 2SD",
        // Quarterly VWAP levels
        "qVWAP VAH 2SD", "qVWAP VAH", "qVWAP", "qVWAP VAL", "qVWAP VAL 2SD",
        // Yearly VWAP levels
        "yVWAP VAH 2SD", "yVWAP VAH", "yVWAP", "yVWAP VAL", "yVWAP VAL 2SD",
        // Composite levels
        "cVAH", "cVAL", "POC",
        // Clinic trends
        "H4 Clinic Trend (EMA 100)", "H4 Clinic Trend (EMA 200)",
        "Daily Clinic Trend (EMA 100)", "Daily Clinic Trend (EMA 200)",
        "Weekly Clinic Trend (EMA 100)", "Weekly Clinic Trend (EMA 200)"
      ],
      triggers: [
        // Price action triggers
        "rejection",
        "reclaim",
        "expansion",
        "breaking through",
        "re-testing",
        // Orderflow triggers
        "AGGR climax",
        "OI flush",
        "OI surge",
        "OI puke"
      ],
      vocabulary: {
        "1D Trend": "Daily Clinic Trend",
        "1d trend": "Daily Clinic Trend",
        "daily trend": "Daily Clinic Trend",
        "H4 Trend": "H4 Clinic Trend",
        "h4 trend": "H4 Clinic Trend",
        "4h trend": "H4 Clinic Trend",
        "1W Trend": "Weekly Clinic Trend",
        "1w trend": "Weekly Clinic Trend",
        "weekly trend": "Weekly Clinic Trend",
        "dVAP": "dVWAP",
        "dvap": "dVWAP",
        "wVAP": "wVWAP",
        "wvap": "wVWAP",
        "mVAP": "mVWAP",
        "mvap": "mVWAP",
        "qVAP": "qVWAP",
        "qvap": "qVWAP",
        "yVAP": "yVWAP",
        "yvap": "yVWAP",
        "comp VAH": "cVAH",
        "comp VAL": "cVAL",
        "composite VAH": "cVAH",
        "composite VAL": "cVAL"
      }
    };

    // Only insert if setup_completed doesn't exist
    const existing = this.getConfig('setup_completed');
    if (existing === null) {
      this.setMultipleConfig(defaults);
      return true;
    }
    return false;
  }
}

module.exports = new ConfigService();
