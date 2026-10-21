const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

const runAnalyticsMigration = async () => {
  try {
    console.log('Checking if analytics migration is needed...');

    // Check if login_attempts table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'login_attempts'
      )
    `);

    if (tableCheck.rows[0].exists) {
      console.log('Analytics migration already applied. Skipping.');
      return;
    }

    console.log('Running analytics migration...');

    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migration_add_analytics.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement);
      }
    }

    console.log('Analytics migration completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
    // Don't throw error - allow server to start even if migration fails
    console.log('Server will continue to start, but some features may not work correctly.');
  }
};

module.exports = runAnalyticsMigration;
