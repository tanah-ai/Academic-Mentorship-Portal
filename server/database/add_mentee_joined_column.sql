-- Add mentee_joined column to mentorship_sessions table
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS mentee_joined BOOLEAN DEFAULT FALSE;
