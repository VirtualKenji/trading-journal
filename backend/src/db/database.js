const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/trading.db');
const schemaPath = path.join(__dirname, 'schema.sql');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create or open database
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

/**
 * Run migrations for schema changes
 */
function runMigrations() {
  console.log('Running migrations...');

  // Helper to check if column exists
  const columnExists = (table, column) => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    return columns.some(col => col.name === column);
  };

  // Migration: Add collateral column to trades table
  if (!columnExists('trades', 'collateral')) {
    console.log('  Adding collateral column to trades table...');
    db.exec('ALTER TABLE trades ADD COLUMN collateral REAL');
    console.log('  ✓ collateral column added');
  }

  // Migration: Add roi column to trades table
  if (!columnExists('trades', 'roi')) {
    console.log('  Adding roi column to trades table...');
    db.exec('ALTER TABLE trades ADD COLUMN roi REAL');
    console.log('  ✓ roi column added');
  }

  // Migration: Add session column to trades table
  if (!columnExists('trades', 'session')) {
    console.log('  Adding session column to trades table...');
    db.exec('ALTER TABLE trades ADD COLUMN session TEXT');
    console.log('  ✓ session column added');
  }

  // Seed default lesson categories if empty
  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM lesson_categories').get();
  if (categoryCount.count === 0) {
    console.log('  Seeding default lesson categories...');
    seedLessonCategories();
    console.log('  ✓ lesson categories seeded');
  }

  // Migration: Move outlook_data and review_data to separate tables
  migrateOutlooksAndReviews();

  console.log('✓ Migrations complete');
}

/**
 * Migrate outlook_data and review_data from trading_days to separate tables
 */
function migrateOutlooksAndReviews() {
  // Check if daily_outlooks table exists (it should after schema runs)
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='daily_outlooks'
  `).get();

  if (!tableExists) {
    console.log('  daily_outlooks table not found, skipping migration');
    return;
  }

  // Get trading_days with outlook_data that haven't been migrated
  const daysWithOutlook = db.prepare(`
    SELECT td.id, td.date, td.outlook_data
    FROM trading_days td
    WHERE td.outlook_data IS NOT NULL
    AND td.has_outlook = 1
    AND NOT EXISTS (SELECT 1 FROM daily_outlooks do WHERE do.trading_day_id = td.id)
  `).all();

  if (daysWithOutlook.length > 0) {
    console.log(`  Migrating ${daysWithOutlook.length} outlook(s) to daily_outlooks table...`);

    const insertOutlook = db.prepare(`
      INSERT INTO daily_outlooks (
        trading_day_id, bias, bias_reasoning, htf_bias, key_levels, setups,
        no_trade_zone, contingency, invalidation, bull_arguments, bear_arguments,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const day of daysWithOutlook) {
      try {
        const data = JSON.parse(day.outlook_data);
        const now = new Date().toISOString();
        insertOutlook.run(
          day.id,
          data.bias || 'unknown',
          data.bias_reasoning || null,
          data.htf_bias || null,
          data.key_levels ? JSON.stringify(data.key_levels) : null,
          data.setups ? JSON.stringify(data.setups) : null,
          data.no_trade_zone ? JSON.stringify(data.no_trade_zone) : null,
          data.contingency ? JSON.stringify(data.contingency) : null,
          data.invalidation ? JSON.stringify(data.invalidation) : null,
          data.bull_arguments ? JSON.stringify(data.bull_arguments) : null,
          data.bear_arguments ? JSON.stringify(data.bear_arguments) : null,
          now,
          now
        );
      } catch (e) {
        console.log(`  Warning: Could not migrate outlook for ${day.date}: ${e.message}`);
      }
    }
    console.log(`  ✓ Migrated ${daysWithOutlook.length} outlook(s)`);
  }

  // Get trading_days with review_data that haven't been migrated
  const daysWithReview = db.prepare(`
    SELECT td.id, td.date, td.review_data
    FROM trading_days td
    WHERE td.review_data IS NOT NULL
    AND td.has_review = 1
    AND NOT EXISTS (SELECT 1 FROM daily_reviews dr WHERE dr.trading_day_id = td.id)
  `).all();

  if (daysWithReview.length > 0) {
    console.log(`  Migrating ${daysWithReview.length} review(s) to daily_reviews table...`);

    const insertReview = db.prepare(`
      INSERT INTO daily_reviews (
        trading_day_id, outlook_grade, execution_grade, emotional_grade,
        bias_correct, reflection, lessons, hindsight, action_items,
        trades_won, trades_lost, total_pnl, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const day of daysWithReview) {
      try {
        const data = JSON.parse(day.review_data);
        const now = new Date().toISOString();

        // Handle various field name variations
        const outlookGrade = data.outlook_grade || data.prediction_grade || data.grades?.analysis || null;
        const executionGrade = data.execution_grade || data.grades?.execution || null;
        const emotionalGrade = data.emotional_grade || data.grades?.emotion || null;

        insertReview.run(
          day.id,
          outlookGrade,
          executionGrade,
          emotionalGrade,
          data.bias_correct !== undefined ? (data.bias_correct ? 1 : 0) : null,
          data.reflection || null,
          data.lessons ? JSON.stringify(data.lessons) : null,
          data.hindsight ? JSON.stringify(data.hindsight) : null,
          data.action_items ? JSON.stringify(data.action_items) : null,
          data.trades_won || data.summary?.wins || 0,
          data.trades_lost || data.summary?.losses || 0,
          data.total_pnl || data.summary?.total_pnl || null,
          now,
          now
        );
      } catch (e) {
        console.log(`  Warning: Could not migrate review for ${day.date}: ${e.message}`);
      }
    }
    console.log(`  ✓ Migrated ${daysWithReview.length} review(s)`);
  }
}

/**
 * Seed default lesson categories
 */
function seedLessonCategories() {
  const categories = [
    // Trading root categories
    { name: 'Trading', description: 'Trading-related lessons', parent: null, order: 1 },
    { name: 'Setups', description: 'Trade setup patterns', parent: 'Trading', order: 1 },
    { name: 'Sessions', description: 'Session timing lessons', parent: 'Trading', order: 2 },
    { name: 'Triggers', description: 'Entry triggers and signals', parent: 'Trading', order: 3 },
    { name: 'Locations', description: 'Price levels and zones', parent: 'Trading', order: 4 },
    { name: 'Risk Management', description: 'Position sizing and risk', parent: 'Trading', order: 5 },

    // Psychology root categories
    { name: 'Psychology', description: 'Mental and emotional lessons', parent: null, order: 2 },
    { name: 'Emotions', description: 'Emotional patterns', parent: 'Psychology', order: 1 },
    { name: 'Discipline', description: 'Rule following and patience', parent: 'Psychology', order: 2 },
    { name: 'Reflection', description: 'Self-analysis and growth', parent: 'Psychology', order: 3 },
  ];

  const insertStmt = db.prepare(`
    INSERT INTO lesson_categories (name, description, parent_id, sort_order)
    VALUES (?, ?, ?, ?)
  `);

  const findParent = db.prepare('SELECT id FROM lesson_categories WHERE name = ?');

  for (const cat of categories) {
    let parentId = null;
    if (cat.parent) {
      const parent = findParent.get(cat.parent);
      if (parent) parentId = parent.id;
    }
    insertStmt.run(cat.name, cat.description, parentId, cat.order);
  }
}

/**
 * Initialize database with schema
 */
function initializeDatabase() {
  console.log('Initializing database...');

  // Split schema into tables and indexes
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const [tablesSection, ...rest] = schema.split('-- Indexes');

  // Create tables first
  db.exec(tablesSection);

  // Run migrations for existing databases (adds new columns)
  runMigrations();

  // Then create indexes (which may reference migrated columns)
  if (rest.length > 0) {
    db.exec('-- Indexes' + rest.join('-- Indexes'));
  }

  console.log('✓ Database initialized successfully');
  console.log(`✓ Database location: ${dbPath}`);

  // Verify tables were created
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table'
    ORDER BY name
  `).all();

  console.log(`✓ Created ${tables.length} tables:`);
  tables.forEach(t => console.log(`  - ${t.name}`));
}

/**
 * Get database instance
 */
function getDatabase() {
  return db;
}

/**
 * Close database connection
 */
function closeDatabase() {
  db.close();
  console.log('Database connection closed');
}

// Initialize on first run
if (require.main === module) {
  initializeDatabase();
  closeDatabase();
}

module.exports = {
  getDatabase,
  initializeDatabase,
  closeDatabase
};
