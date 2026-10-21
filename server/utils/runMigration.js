const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

const runAnalyticsMigration = async () => {
  try {
    console.log('Running analytics migration...');

    // Add activity_score column to users table
    try {
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS activity_score INTEGER DEFAULT 0
      `);
      console.log('Added activity_score column to users table');
    } catch (err) {
      console.log('activity_score column already exists or error:', err.message);
    }

    // Add action_taken column to help_nudges table
    try {
      await pool.query(`
        ALTER TABLE help_nudges ADD COLUMN IF NOT EXISTS action_taken VARCHAR(20)
      `);
      console.log('Added action_taken column to help_nudges table');
    } catch (err) {
      console.log('action_taken column already exists or error:', err.message);
    }

    // Add action_taken_at column to help_nudges table
    try {
      await pool.query(`
        ALTER TABLE help_nudges ADD COLUMN IF NOT EXISTS action_taken_at TIMESTAMP
      `);
      console.log('Added action_taken_at column to help_nudges table');
    } catch (err) {
      console.log('action_taken_at column already exists or error:', err.message);
    }

    // Create login_attempts table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS login_attempts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          email VARCHAR(255) NOT NULL,
          success BOOLEAN NOT NULL,
          failure_reason VARCHAR(100),
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Created login_attempts table');
    } catch (err) {
      console.log('login_attempts table already exists or error:', err.message);
    }

    // Create indexes for login_attempts
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON login_attempts(user_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at)
      `);
      console.log('Created indexes for login_attempts table');
    } catch (err) {
      console.log('Indexes already exist or error:', err.message);
    }

    console.log('Analytics migration completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
    // Don't throw error - allow server to start even if migration fails
    console.log('Server will continue to start, but some features may not work correctly.');
  }
};

module.exports = runAnalyticsMigration;
