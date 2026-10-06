-- Add can_teach column to user_modules table
ALTER TABLE user_modules ADD COLUMN IF NOT EXISTS can_teach BOOLEAN DEFAULT FALSE;
