-- Insert default badges for gamification system
-- Run this if badges table is empty

INSERT INTO badges (name, description, icon, requirement_type, requirement_value, points) VALUES
('First Session', 'Completed your first mentorship session', '🎯', 'sessions_completed', 1, 10),
('Rising Star', 'Completed 5 mentorship sessions', '⭐', 'sessions_completed', 5, 50),
('Expert Mentor', 'Completed 20 mentorship sessions', '🏆', 'sessions_completed', 20, 200),
('Top Rated', 'Maintained an average rating of 4.5+', '💎', 'rating_average', 45, 100),
('Helpful Hero', 'Received 10 positive feedback ratings', '🦸', 'positive_feedback', 10, 75),
('Consistent Helper', 'Completed sessions in 5 different modules', '📚', 'modules_variety', 5, 150),
('Night Owl', 'Completed sessions after 10 PM', '🦉', 'late_sessions', 1, 25),
('Quick Responder', 'Responded to session requests within 1 hour', '⚡', 'quick_response', 1, 30)
ON CONFLICT (name) DO NOTHING;
