-- Table 1: trading_days
CREATE TABLE IF NOT EXISTS trading_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  has_outlook BOOLEAN DEFAULT 0,
  has_review BOOLEAN DEFAULT 0,
  outlook_data TEXT,
  review_data TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Table 2: trades
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_number TEXT NOT NULL UNIQUE,
  trading_day_id INTEGER,

  asset TEXT NOT NULL,
  direction TEXT NOT NULL,
  entry_price REAL,
  exit_price REAL,
  position_size REAL,
  leverage REAL,
  liquidation_price REAL,

  setup TEXT,
  location TEXT,
  trigger TEXT,

  pnl REAL,
  pnl_percentage REAL,
  outcome TEXT,

  initial_emotion TEXT,
  planned_in_outlook BOOLEAN DEFAULT 0,
  is_scaled_trade BOOLEAN DEFAULT 0,
  parent_trade_id INTEGER,

  status TEXT DEFAULT 'open',

  opened_at TEXT NOT NULL,
  closed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (trading_day_id) REFERENCES trading_days(id),
  FOREIGN KEY (parent_trade_id) REFERENCES trades(id)
);

-- Table 3: trade_updates
CREATE TABLE IF NOT EXISTS trade_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_id INTEGER NOT NULL,
  update_type TEXT NOT NULL,
  content TEXT,
  emotion TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (trade_id) REFERENCES trades(id)
);

-- Table 4: screenshots
CREATE TABLE IF NOT EXISTS screenshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  extracted_data TEXT,
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Table 5: journal_entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  markdown_content TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Table 6: chat_sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_type TEXT NOT NULL,
  entity_id INTEGER,
  messages TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

-- Table 7: system_config
CREATE TABLE IF NOT EXISTS system_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_trading_day ON trades(trading_day_id);
CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(opened_at);
CREATE INDEX IF NOT EXISTS idx_trading_days_date ON trading_days(date);
CREATE INDEX IF NOT EXISTS idx_screenshots_entity ON screenshots(entity_type, entity_id);
