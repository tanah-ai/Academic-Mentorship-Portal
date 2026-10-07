const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

// Temporary endpoint to run database schema
router.get('/init-db', async (req, res) => {
  try {
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const modulesPath = path.join(__dirname, '../database/bulk_insert_modules.sql');
    const badgesPath = path.join(__dirname, '../database/insert_default_badges.sql');

    // Read and execute schema
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('Schema executed successfully');

    // Read and execute modules
    const modules = fs.readFileSync(modulesPath, 'utf8');
    await pool.query(modules);
    console.log('Modules inserted successfully');

    // Read and execute badges
    const badges = fs.readFileSync(badgesPath, 'utf8');
    await pool.query(badges);
    console.log('Badges inserted successfully');

    res.json({ success: true, message: 'Database initialized successfully' });
  } catch (error) {
    console.error('Database initialization error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
