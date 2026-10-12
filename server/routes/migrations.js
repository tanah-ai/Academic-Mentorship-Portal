const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

// Temporary endpoint to run database migrations
router.get('/run-migrations', async (req, res) => {
  try {
    const migrationPath = path.join(__dirname, '../database/add_reset_token_columns.sql');
    
    // Read and execute migration
    const migration = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migration);
    console.log('Migration executed successfully');
    
    res.json({ success: true, message: 'Database migration completed successfully' });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
