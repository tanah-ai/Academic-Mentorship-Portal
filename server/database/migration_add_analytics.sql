-- Migration to add analytics enhancements
-- Run this on existing databases to add new tables and columns

-- Add activity_score column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS activity_score INTEGER DEFAULT 0;

-- Add action_taken and action_taken_at columns to help_nudges table
ALTER TABLE help_nudges ADD COLUMN IF NOT EXISTS action_taken VARCHAR(20);
ALTER TABLE help_nudges ADD COLUMN IF NOT EXISTS action_taken_at TIMESTAMP;

-- Create login_attempts table if it doesn't exist
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for login_attempts if they don't exist
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at);
