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

  console.log('✓ Migrations complete');
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
