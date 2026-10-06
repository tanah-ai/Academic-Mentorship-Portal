-- Add account security columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP,
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP;

-- Create index on locked_until for faster queries
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until);
