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
  collateral REAL,
  leverage REAL,
  liquidation_price REAL,

  setup TEXT,
  location TEXT,
  trigger TEXT,
  session TEXT,

  pnl REAL,
  pnl_percentage REAL,
  roi REAL,
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

-- Table 8: lesson_categories (hierarchical)
CREATE TABLE IF NOT EXISTS lesson_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  parent_id INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (parent_id) REFERENCES lesson_categories(id)
);

-- Table 9: lessons
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  conditions TEXT,  -- JSON: {setup:[], session:[], trigger:[], emotion:[], location:[]}
  learned_at TEXT NOT NULL,
  stats_before TEXT,  -- JSON snapshot at lesson creation
  stats_after TEXT,   -- JSON snapshot updated periodically
  status TEXT DEFAULT 'active',  -- draft|active|validated|invalidated|archived
  validation_note TEXT,
  trade_count_before INTEGER DEFAULT 0,
  trade_count_after INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (category_id) REFERENCES lesson_categories(id)
);

-- Table 10: lesson_applications (track if lesson was applied to a trade)
CREATE TABLE IF NOT EXISTS lesson_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL,
  trade_id INTEGER NOT NULL,
  applied BOOLEAN,  -- did trader follow the lesson?
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (lesson_id) REFERENCES lessons(id),
  FOREIGN KEY (trade_id) REFERENCES trades(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_trading_day ON trades(trading_day_id);
CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(opened_at);
CREATE INDEX IF NOT EXISTS idx_trading_days_date ON trading_days(date);
CREATE INDEX IF NOT EXISTS idx_screenshots_entity ON screenshots(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_trades_session ON trades(session);
CREATE INDEX IF NOT EXISTS idx_lessons_category ON lessons(category_id);
CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status);
CREATE INDEX IF NOT EXISTS idx_lesson_applications_lesson ON lesson_applications(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_applications_trade ON lesson_applications(trade_id);
