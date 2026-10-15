const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');

// @route   POST /api/matching/find-mentor
// @desc    Find available mentors for a specific module
// @access  Private
router.post('/find-mentor', [
  body('module_code').notEmpty().withMessage('Module code is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { module_code, preferred_time, faculty } = req.body;

    // Get module ID
    const moduleResult = await pool.query(
      'SELECT id FROM modules WHERE module_code = $1',
      [module_code]
    );

    if (moduleResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    const module_id = moduleResult.rows[0].id;

    // Find available mentors for this module
    // MSU Matching algorithm considers: verification status, student level (2+), reputation score, availability
    const mentorsResult = await pool.query(
      `SELECT u.id, u.student_id, u.first_name, u.last_name, u.faculty, u.campus, 
              u.reputation_score, u.total_sessions, u.student_level,
              um.grade, um.semester_completed, um.year_completed,
              COUNT(DISTINCT ms.id) as active_sessions
       FROM users u
       JOIN user_modules um ON u.id = um.user_id
       LEFT JOIN mentorship_sessions ms ON u.id = ms.mentor_id AND ms.status = 'scheduled'
       WHERE u.user_type = 'mentor' 
         AND u.is_mentor_verified = true 
         AND u.student_level >= 2
         AND um.module_id = $1
         AND um.is_verified = true
         ${faculty ? 'AND u.faculty = $2' : ''}
       GROUP BY u.id, um.grade, um.semester_completed, um.year_completed
       ORDER BY u.reputation_score DESC, active_sessions ASC
       LIMIT 10`,
      faculty ? [module_id, faculty] : [module_id]
    );

    // Track analytics for matching
    await pool.query(
      `INSERT INTO analytics_events (user_id, event_type, event_data, module_id)
       VALUES ($1, 'mentor_search', $2, $3)`,
      [decoded.id, JSON.stringify({ module_code, results_count: mentorsResult.rows.length }), module_id]
    );

    res.json({ 
      success: true, 
      mentors: mentorsResult.rows,
      module_code
    });
  } catch (error) {
    console.error('Find mentor error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   POST /api/matching/auto-match
// @desc    Automatically match mentee with best available mentor
// @access  Private
router.post('/auto-match', [
  body('module_code').notEmpty().withMessage('Module code is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { module_code } = req.body;

    // Get module ID
    const moduleResult = await pool.query(
      'SELECT id FROM modules WHERE module_code = $1',
      [module_code]
    );

    if (moduleResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    const module_id = moduleResult.rows[0].id;

    // Automated matching algorithm:
    // 1. Prioritize verified mentors with highest reputation scores
    // 2. Consider mentor's current session load (avoid overloading)
    // 3. Match mentors with highest grades in the specific module (MSU grading: Distinction, 2.1, 2.2)
    const bestMatchResult = await pool.query(
      `SELECT u.id, u.student_id, u.first_name, u.last_name, u.faculty, u.campus, 
              u.reputation_score, u.total_sessions, u.student_level,
              um.grade,
              COUNT(DISTINCT ms.id) as active_sessions,
              -- Calculate match score: reputation (40%) + grade quality (30%) + availability (30%)
              -- MSU Grading: Distinction=100, 2.1=90, 2.2=80, 3=50
              (u.reputation_score * 0.4 + 
               CASE 
                 WHEN UPPER(um.grade) IN ('A', 'DISTINCTION', 'D') THEN 100
                 WHEN UPPER(um.grade) IN ('2.1', 'FIRST CLASS') THEN 90
                 WHEN UPPER(um.grade) IN ('2.2', 'SECOND CLASS') THEN 80
                 WHEN UPPER(um.grade) IN ('3', 'FAIL', 'F') THEN 50
                 ELSE 70
               END * 0.3 +
               GREATEST(0, 10 - COUNT(DISTINCT ms.id)) * 3) as match_score
       FROM users u
       JOIN user_modules um ON u.id = um.user_id
       LEFT JOIN mentorship_sessions ms ON u.id = ms.mentor_id AND ms.status IN ('scheduled', 'in_progress')
       WHERE u.user_type = 'mentor' 
         AND u.is_mentor_verified = true 
         AND u.student_level >= 2
         AND um.module_id = $1
         AND um.is_verified = true
       GROUP BY u.id, um.grade
       ORDER BY match_score DESC, active_sessions ASC
       LIMIT 1`,
      [module_id]
    );

    if (bestMatchResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No verified mentors available for this module' 
      });
    }

    const bestMatch = bestMatchResult.rows[0];

    // Track analytics for auto-match
    await pool.query(
      `INSERT INTO analytics_events (user_id, event_type, event_data, module_id)
       VALUES ($1, 'auto_match', $2, $3)`,
      [decoded.id, JSON.stringify({ matched_mentor_id: bestMatch.id, match_score: bestMatch.match_score }), module_id]
    );

    res.json({ 
      success: true, 
      mentor: bestMatch,
      match_score: bestMatch.match_score
    });
  } catch (error) {
    console.error('Auto match error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/matching/recommendations
// @desc    Get personalized mentor recommendations based on user behavior
// @access  Private
router.get('/recommendations', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Analyze user's search and session history to recommend modules and mentors
    const analyticsResult = await pool.query(
      `SELECT module_id, COUNT(*) as search_count
       FROM analytics_events
       WHERE user_id = $1 AND event_type = 'mentor_search'
       AND created_at > NOW() - INTERVAL '30 days'
       GROUP BY module_id
       ORDER BY search_count DESC
       LIMIT 5`,
      [decoded.id]
    );

    const recommendations = [];

    for (const analytics of analyticsResult.rows) {
      // Get top mentors for frequently searched modules
      const mentorsResult = await pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.reputation_score,
                m.module_code, m.module_name
         FROM users u
         JOIN user_modules um ON u.id = um.user_id
         JOIN modules m ON um.module_id = m.id
         WHERE u.user_type = 'mentor' 
           AND u.is_mentor_verified = true 
           AND um.module_id = $1
           AND um.is_verified = true
         ORDER BY u.reputation_score DESC
         LIMIT 3`,
        [analytics.module_id]
      );

      if (mentorsResult.rows.length > 0) {
        recommendations.push({
          module: mentorsResult.rows[0],
          mentors: mentorsResult.rows,
          search_count: analytics.search_count
        });
      }
    }

    res.json({ success: true, recommendations });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/matching/availability/:mentor_id
// @desc    Check mentor availability for scheduling
// @access  Private
router.get('/availability/:mentor_id', async (req, res) => {
  try {
    const { date } = req.query;

    const mentorResult = await pool.query(
      `SELECT u.id, u.first_name, u.last_name,
              COUNT(CASE WHEN ms.status = 'scheduled' AND ms.scheduled_date::date = $1 THEN 1 END) as scheduled_sessions
       FROM users u
       LEFT JOIN mentorship_sessions ms ON u.id = ms.mentor_id
       WHERE u.id = $2 AND u.user_type = 'mentor' AND u.is_mentor_verified = true
       GROUP BY u.id`,
      [date || new Date().toISOString().split('T')[0], req.params.mentor_id]
    );

    if (mentorResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Mentor not found' });
    }

    const mentor = mentorResult.rows[0];
    const isAvailable = mentor.scheduled_sessions < 5; // Max 5 sessions per day

    res.json({ 
      success: true, 
      mentor_id: mentor.id,
      is_available: isAvailable,
      scheduled_sessions: mentor.scheduled_sessions,
      max_daily_sessions: 5
    });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
