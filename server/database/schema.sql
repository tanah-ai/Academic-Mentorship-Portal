-- MSU Academic Mentorship Portal Database Schema
-- PostgreSQL Database Schema

-- Drop existing tables if they exist (for development)
DROP TABLE IF EXISTS session_participants CASCADE;
DROP TABLE IF EXISTS mentorship_sessions CASCADE;
DROP TABLE IF EXISTS user_modules CASCADE;
DROP TABLE IF EXISTS transcript_verifications CASCADE;
DROP TABLE IF EXISTS badges CASCADE;
DROP TABLE IF EXISTS user_badges CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS analytics_events CASCADE;
DROP TABLE IF EXISTS help_nudges CASCADE;
DROP TABLE IF EXISTS modules CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('mentee', 'mentor', 'admin')),
    faculty VARCHAR(100),
    campus VARCHAR(50),
    phone VARCHAR(20),
    student_level INTEGER DEFAULT 1 CHECK (student_level >= 1 AND student_level <= 4),
    year_of_study INTEGER DEFAULT 1 CHECK (year_of_study >= 1 AND year_of_study <= 4),
    msu_verified BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_mentor_verified BOOLEAN DEFAULT FALSE,
    reputation_score INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    data_lite_mode BOOLEAN DEFAULT FALSE
);

-- Create index on student_id and email for faster lookups
CREATE INDEX idx_users_student_id ON users(student_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_user_type ON users(user_type);

-- Modules table
CREATE TABLE modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_code VARCHAR(20) UNIQUE NOT NULL,
    module_name VARCHAR(255) NOT NULL,
    faculty VARCHAR(100) NOT NULL,
    level INTEGER NOT NULL CHECK (level >= 1 AND level <= 5),
    semester VARCHAR(20) NOT NULL,
    credits INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_modules_code ON modules(module_code);
CREATE INDEX idx_modules_faculty ON modules(faculty);

-- User-Modules relationship (for mentors to specify their expertise)
CREATE TABLE user_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    grade VARCHAR(5) NOT NULL, -- Grade achieved (e.g., 'A', 'B+', etc.)
    semester_completed VARCHAR(20),
    year_completed INTEGER,
    is_verified BOOLEAN DEFAULT FALSE,
    can_teach BOOLEAN DEFAULT FALSE, -- Whether the mentor can teach this module (only true for grades A, 2.1, 2.2)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, module_id)
);

CREATE INDEX idx_user_modules_user_id ON user_modules(user_id);
CREATE INDEX idx_user_modules_module_id ON user_modules(module_id);

-- Transcript verifications table
CREATE TABLE transcript_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_path VARCHAR(500),
    file_name VARCHAR(255),
    file_size INTEGER,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
    verified_by UUID REFERENCES users(id),
    verification_date TIMESTAMP,
    rejection_reason TEXT,
    is_purged BOOLEAN DEFAULT FALSE -- For security - files are purged after verification
);

CREATE INDEX idx_transcript_verifications_user_id ON transcript_verifications(user_id);
CREATE INDEX idx_transcript_verifications_status ON transcript_verifications(verification_status);

-- Mentorship sessions table
CREATE TABLE mentorship_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    session_title VARCHAR(255) NOT NULL,
    description TEXT,
    scheduled_date TIMESTAMP NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    meeting_link VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_sessions_mentee_id ON mentorship_sessions(mentee_id);
CREATE INDEX idx_sessions_mentor_id ON mentorship_sessions(mentor_id);
CREATE INDEX idx_sessions_module_id ON mentorship_sessions(module_id);
CREATE INDEX idx_sessions_status ON mentorship_sessions(status);
CREATE INDEX idx_sessions_scheduled_date ON mentorship_sessions(scheduled_date);

-- Session participants table (for group sessions)
CREATE TABLE session_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES mentorship_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    UNIQUE(session_id, user_id)
);

CREATE INDEX idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX idx_session_participants_user_id ON session_participants(user_id);

-- Feedback table
CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES mentorship_sessions(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, from_user_id, to_user_id)
);

CREATE INDEX idx_feedback_session_id ON feedback(session_id);
CREATE INDEX idx_feedback_to_user_id ON feedback(to_user_id);

-- Badges table (gamification)
CREATE TABLE badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    requirement_type VARCHAR(50) NOT NULL, -- e.g., 'sessions_completed', 'rating_average', etc.
    requirement_value INTEGER NOT NULL,
    points INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User badges relationship
CREATE TABLE user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX idx_user_badges_badge_id ON user_badges(badge_id);

-- Analytics events table (for predictive nudges)
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- e.g., 'search', 'session_request', 'login', etc.
    event_data JSONB,
    module_id UUID REFERENCES modules(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_module_id ON analytics_events(module_id);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at);

-- Help nudges table (predictive analytics)
CREATE TABLE help_nudges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    nudge_type VARCHAR(50) NOT NULL, -- e.g., 'struggling_detected', 'high_demand', etc.
    message TEXT NOT NULL,
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP,
    is_dismissed BOOLEAN DEFAULT FALSE,
    dismissed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_help_nudges_user_id ON help_nudges(user_id);
CREATE INDEX idx_help_nudges_module_id ON help_nudges(module_id);
CREATE INDEX idx_help_nudges_is_sent ON help_nudges(is_sent);

-- Insert default badges
INSERT INTO badges (name, description, icon, requirement_type, requirement_value, points) VALUES
('First Session', 'Completed your first mentorship session', '🎯', 'sessions_completed', 1, 10),
('Rising Star', 'Completed 5 mentorship sessions', '⭐', 'sessions_completed', 5, 50),
('Expert Mentor', 'Completed 20 mentorship sessions', '🏆', 'sessions_completed', 20, 200),
('Top Rated', 'Maintained an average rating of 4.5+', '💎', 'rating_average', 45, 100),
('Helpful Hero', 'Received 10 positive feedback ratings', '🦸', 'positive_feedback', 10, 75),
('Consistent Helper', 'Completed sessions in 5 different modules', '📚', 'modules_variety', 5, 150),
('Night Owl', 'Completed sessions after 10 PM', '🦉', 'late_sessions', 1, 25),
('Quick Responder', 'Responded to session requests within 1 hour', '⚡', 'quick_response', 1, 30);

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mentorship_sessions_updated_at BEFORE UPDATE ON mentorship_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
