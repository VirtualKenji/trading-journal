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
 * Initialize database with schema
 */
function initializeDatabase() {
  console.log('Initializing database...');

  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

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
