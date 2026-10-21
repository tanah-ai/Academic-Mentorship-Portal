const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Helper function to calculate activity score for a user
const calculateActivityScore = async (userId) => {
  try {
    // Get current activity score
    const userResult = await pool.query('SELECT activity_score FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) return 0;

    const currentScore = userResult.rows[0].activity_score || 0;

    // Calculate score based on activities
    // Login: +1 (already tracked in auth.js)
    // Mentor search: +2
    const searchCount = await pool.query(
      `SELECT COUNT(*) as count FROM analytics_events WHERE user_id = $1 AND event_type = 'mentor_search'`,
      [userId]
    );
    const searchScore = parseInt(searchCount.rows[0].count) * 2;

    // Session booked: +5
    const bookedCount = await pool.query(
      `SELECT COUNT(*) as count FROM mentorship_sessions WHERE mentee_id = $1`,
      [userId]
    );
    const bookedScore = parseInt(bookedCount.rows[0].count) * 5;

    // Session completed as mentor: +10
    const mentorCompletedCount = await pool.query(
      `SELECT COUNT(*) as count FROM mentorship_sessions WHERE mentor_id = $1 AND status = 'completed'`,
      [userId]
    );
    const mentorCompletedScore = parseInt(mentorCompletedCount.rows[0].count) * 10;

    // Session completed as mentee: +5
    const menteeCompletedCount = await pool.query(
      `SELECT COUNT(*) as count FROM mentorship_sessions WHERE mentee_id = $1 AND status = 'completed'`,
      [userId]
    );
    const menteeCompletedScore = parseInt(menteeCompletedCount.rows[0].count) * 5;

    // Feedback given: +3
    const feedbackCount = await pool.query(
      `SELECT COUNT(*) as count FROM feedback WHERE from_user_id = $1`,
      [userId]
    );
    const feedbackScore = parseInt(feedbackCount.rows[0].count) * 3;

    // Badges earned: +15
    const badgeCount = await pool.query(
      `SELECT COUNT(*) as count FROM user_badges WHERE user_id = $1`,
      [userId]
    );
    const badgeScore = parseInt(badgeCount.rows[0].count) * 15;

    const totalScore = currentScore + searchScore + bookedScore + mentorCompletedScore + menteeCompletedScore + feedbackScore + badgeScore;

    // Update user's activity score
    await pool.query('UPDATE users SET activity_score = $1 WHERE id = $2', [totalScore, userId]);

    return totalScore;
  } catch (error) {
    console.error('Calculate activity score error:', error);
    return 0;
  }
};

// @route   POST /api/analytics/track
// @desc    Track analytics event
// @access  Private
router.post('/track', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { event_type, event_data, module_id } = req.body;

    await pool.query(
      `INSERT INTO analytics_events (user_id, event_type, event_data, module_id)
       VALUES ($1, $2, $3, $4)`,
      [decoded.id, event_type, JSON.stringify(event_data), module_id || null]
    );

    res.json({ success: true, message: 'Event tracked successfully' });
  } catch (error) {
    console.error('Track analytics error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/analytics/user-activity
// @desc    Get user activity analytics
// @access  Private
router.get('/user-activity', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { days = 30 } = req.query;

    const result = await pool.query(
      `SELECT event_type, COUNT(*) as count, 
              DATE(created_at) as date
       FROM analytics_events
       WHERE user_id = $1 
         AND created_at > NOW() - INTERVAL '${days} days'
       GROUP BY event_type, DATE(created_at)
       ORDER BY date DESC, count DESC`,
      [decoded.id]
    );

    res.json({ success: true, activity: result.rows });
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/analytics/module-demand
// @desc    Get module demand analytics (high-demand modules)
// @access  Private
router.get('/module-demand', async (req, res) => {
  try {
    const { days = 30, limit = 10 } = req.query;

    const result = await pool.query(
      `SELECT m.module_code, m.module_name, m.faculty,
              COUNT(*) as search_count,
              COUNT(DISTINCT ae.user_id) as unique_users
       FROM analytics_events ae
       JOIN modules m ON ae.module_id = m.id
       WHERE ae.event_type = 'mentor_search'
         AND ae.created_at > NOW() - INTERVAL '${days} days'
       GROUP BY m.id, m.module_code, m.module_name, m.faculty
       ORDER BY search_count DESC
       LIMIT $1`,
      [limit]
    );

    res.json({ success: true, module_demand: result.rows });
  } catch (error) {
    console.error('Get module demand error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/analytics/predictive-nudges
// @desc    Get predictive help nudges for user
// @access  Private
router.get('/predictive-nudges', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get unsent nudges
    const result = await pool.query(
      `SELECT hn.*, m.module_code, m.module_name
       FROM help_nudges hn
       JOIN modules m ON hn.module_id = m.id
       WHERE hn.user_id = $1 AND hn.is_sent = false AND hn.is_dismissed = false
       ORDER BY hn.created_at ASC`,
      [decoded.id]
    );

    res.json({ success: true, nudges: result.rows });
  } catch (error) {
    console.error('Get predictive nudges error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   POST /api/analytics/generate-nudges
// @desc    Generate predictive help nudges (admin/cron job)
// @access  Private
router.post('/generate-nudges', async (req, res) => {
  try {
    const nudgesCreated = [];

    // Rule 1: Send nudge 5-10 minutes after single search without booking
    const singleSearchUsers = await pool.query(
      `SELECT DISTINCT ae.user_id, ae.module_id, ae.created_at as search_time,
              m.module_code, m.module_name
       FROM analytics_events ae
       JOIN modules m ON ae.module_id = m.id
       WHERE ae.event_type = 'mentor_search'
         AND ae.created_at > NOW() - INTERVAL '10 minutes'
         AND NOT EXISTS (
           SELECT 1 FROM mentorship_sessions ms
           WHERE ms.mentee_id = ae.user_id
             AND ms.module_id = ae.module_id
             AND ms.created_at > ae.created_at
         )
         AND NOT EXISTS (
           SELECT 1 FROM help_nudges hn
           WHERE hn.user_id = ae.user_id
             AND hn.module_id = ae.module_id
             AND hn.created_at > ae.created_at
         )
       LIMIT 20`
    );

    for (const user of singleSearchUsers.rows) {
      // Check if 5-10 minutes have passed since search
      const timeSinceSearch = Date.now() - new Date(user.search_time).getTime();
      const minutesSinceSearch = timeSinceSearch / (1000 * 60);

      if (minutesSinceSearch >= 5 && minutesSinceSearch <= 10) {
        const nudgeResult = await pool.query(
          `INSERT INTO help_nudges (user_id, module_id, nudge_type, message)
           VALUES ($1, $2, 'single_search_timeout', $3)
           RETURNING id`,
          [user.user_id, user.module_id,
           `We noticed you searched for help with ${user.module_code} but haven't booked a session yet. Would you like to connect with a verified mentor?`]
        );
        nudgesCreated.push(nudgeResult.rows[0].id);
      }
    }

    // Rule 2: Send nudge immediately after 3rd search without booking
    const tripleSearchUsers = await pool.query(
      `SELECT ae.user_id, ae.module_id, COUNT(*) as search_count,
              MAX(ae.created_at) as last_search_time,
              m.module_code, m.module_name
       FROM analytics_events ae
       JOIN modules m ON ae.module_id = m.id
       WHERE ae.event_type = 'mentor_search'
         AND ae.created_at > NOW() - INTERVAL '1 hour'
         AND NOT EXISTS (
           SELECT 1 FROM mentorship_sessions ms
           WHERE ms.mentee_id = ae.user_id
             AND ms.module_id = ae.module_id
             AND ms.created_at > NOW() - INTERVAL '1 hour'
         )
         AND NOT EXISTS (
           SELECT 1 FROM help_nudges hn
           WHERE hn.user_id = ae.user_id
             AND hn.module_id = ae.module_id
             AND hn.nudge_type = 'triple_search_detected'
             AND hn.created_at > NOW() - INTERVAL '1 hour'
         )
       GROUP BY ae.user_id, ae.module_id, m.module_code, m.module_name
       HAVING COUNT(*) >= 3
       LIMIT 20`
    );

    for (const user of tripleSearchUsers.rows) {
      const nudgeResult = await pool.query(
        `INSERT INTO help_nudges (user_id, module_id, nudge_type, message)
         VALUES ($1, $2, 'triple_search_detected', $3)
         RETURNING id`,
        [user.user_id, user.module_id,
         `You've searched for help with ${user.module_code} multiple times. Connect with a verified mentor now!`]
      );
      nudgesCreated.push(nudgeResult.rows[0].id);
    }

    // Find high-demand modules and suggest mentors to help
    const highDemandModulesResult = await pool.query(
      `SELECT m.id, m.module_code, m.module_name,
              COUNT(*) as search_count
       FROM analytics_events ae
       JOIN modules m ON ae.module_id = m.id
       WHERE ae.event_type = 'mentor_search'
         AND ae.created_at > NOW() - INTERVAL '3 days'
       GROUP BY m.id, m.module_code, m.module_name
       HAVING COUNT(*) >= 5
       LIMIT 5`
    );

    for (const module of highDemandModulesResult.rows) {
      // Find verified mentors for this module
      const mentorsResult = await pool.query(
        `SELECT u.id, u.first_name, u.last_name
         FROM users u
         JOIN user_modules um ON u.id = um.user_id
         WHERE u.user_type = 'mentor'
           AND u.is_mentor_verified = true
           AND um.module_id = $1
           AND um.is_verified = true
         LIMIT 5`,
        [module.id]
      );

      // Notify mentors about high demand (in a real system, this would send notifications)
      for (const mentor of mentorsResult.rows) {
        await pool.query(
          `INSERT INTO analytics_events (user_id, event_type, event_data, module_id)
           VALUES ($1, 'high_demand_alert', $2, $3)`,
          [mentor.id,
           JSON.stringify({
             message: `High demand for ${module.module_code} - students need your help!`,
             search_count: module.search_count
           }),
           module.id]
        );
      }
    }

    res.json({
      success: true,
      nudges_created: nudgesCreated.length,
      high_demand_modules: highDemandModulesResult.rows.length
    });
  } catch (error) {
    console.error('Generate nudges error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   PUT /api/analytics/nudges/:id/dismiss
// @desc    Dismiss a help nudge
// @access  Private
router.put('/nudges/:id/dismiss', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await pool.query(
      `UPDATE help_nudges 
       SET is_dismissed = true, dismissed_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, decoded.id]
    );

    res.json({ success: true, message: 'Nudge dismissed' });
  } catch (error) {
    console.error('Dismiss nudge error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/analytics/dashboard
// @desc    Get admin dashboard analytics
// @access  Private
router.get('/dashboard', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    // Total users
    const totalUsers = await pool.query(
      'SELECT COUNT(*) as count FROM users'
    );

    // Total sessions
    const totalSessions = await pool.query(
      `SELECT COUNT(*) as count,
              COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
              COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled
       FROM mentorship_sessions
       WHERE created_at > NOW() - INTERVAL '${days} days'`
    );

    // Module demand
    const moduleDemand = await pool.query(
      `SELECT m.module_code, COUNT(*) as search_count
       FROM analytics_events ae
       JOIN modules m ON ae.module_id = m.id
       WHERE ae.event_type = 'mentor_search'
         AND ae.created_at > NOW() - INTERVAL '${days} days'
       GROUP BY m.module_code
       ORDER BY search_count DESC
       LIMIT 5`
    );

    // Active mentors
    const activeMentors = await pool.query(
      `SELECT COUNT(*) as count
       FROM users
       WHERE user_type = 'mentor' AND is_mentor_verified = true`
    );

    // Login statistics
    const loginStats = await pool.query(
      `SELECT
         COUNT(*) as total_logins,
         COUNT(CASE WHEN success = true THEN 1 END) as successful_logins,
         COUNT(CASE WHEN success = false THEN 1 END) as failed_logins
       FROM login_attempts
       WHERE created_at > NOW() - INTERVAL '${days} days'`
    );

    // Recent activity
    const recentActivity = await pool.query(
      `SELECT ae.event_type, ae.created_at, u.first_name, u.last_name
       FROM analytics_events ae
       JOIN users u ON ae.user_id = u.id
       ORDER BY ae.created_at DESC
       LIMIT 10`
    );

    res.json({
      success: true,
      dashboard: {
        total_users: parseInt(totalUsers.rows[0].count),
        total_sessions: totalSessions.rows[0],
        active_mentors: parseInt(activeMentors.rows[0].count),
        login_stats: loginStats.rows[0],
        module_demand: moduleDemand.rows,
        recent_activity: recentActivity.rows
      }
    });
  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/analytics/top-performers
// @desc    Get top performers (mentors, mentees, students)
// @access  Private
router.get('/top-performers', async (req, res) => {
  try {
    const { limit = 10, type = 'all' } = req.query;

    let mentors = [];
    let mentees = [];
    let students = [];

    if (type === 'all' || type === 'mentors') {
      // Top mentors by sessions completed and ratings
      mentors = await pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.email,
                COUNT(ms.id) as sessions_completed,
                COALESCE(AVG(f.rating), 0) as avg_rating,
                u.activity_score
         FROM users u
         LEFT JOIN mentorship_sessions ms ON u.id = ms.mentor_id AND ms.status = 'completed'
         LEFT JOIN feedback f ON ms.id = f.session_id AND f.to_user_id = u.id
         WHERE u.user_type = 'mentor' AND u.is_mentor_verified = true
         GROUP BY u.id
         ORDER BY sessions_completed DESC, avg_rating DESC, activity_score DESC
         LIMIT $1`,
        [limit]
      );
    }

    if (type === 'all' || type === 'mentees') {
      // Top mentees by sessions booked and activity score
      mentees = await pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.email,
                COUNT(ms.id) as sessions_booked,
                u.activity_score
         FROM users u
         LEFT JOIN mentorship_sessions ms ON u.id = ms.mentee_id
         WHERE u.user_type = 'mentee'
         GROUP BY u.id
         ORDER BY sessions_booked DESC, activity_score DESC
         LIMIT $1`,
        [limit]
      );
    }

    if (type === 'all' || type === 'students') {
      // Top students by activity score
      students = await pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.user_type,
                u.activity_score,
                COUNT(ae.id) as total_activities
         FROM users u
         LEFT JOIN analytics_events ae ON u.id = ae.user_id
         GROUP BY u.id
         ORDER BY activity_score DESC, total_activities DESC
         LIMIT $1`,
        [limit]
      );
    }

    res.json({
      success: true,
      top_performers: {
        mentors: mentors.rows,
        mentees: mentees.rows,
        students: students.rows
      }
    });
  } catch (error) {
    console.error('Get top performers error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   POST /api/analytics/generate-reports
// @desc    Generate daily, weekly, monthly reports
// @access  Private (admin)
router.post('/generate-reports', async (req, res) => {
  try {
    const { report_type = 'all' } = req.body;

    const reports = {};

    // Daily report
    if (report_type === 'all' || report_type === 'daily') {
      const dailyLogins = await pool.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN success = true THEN 1 END) as successful,
                COUNT(CASE WHEN success = false THEN 1 END) as failed
         FROM login_attempts
         WHERE created_at > NOW() - INTERVAL '1 day'`
      );

      const dailySessions = await pool.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled
         FROM mentorship_sessions
         WHERE created_at > NOW() - INTERVAL '1 day'`
      );

      const dailyActivity = await pool.query(
        `SELECT COUNT(*) as total_events,
                COUNT(DISTINCT user_id) as active_users
         FROM analytics_events
         WHERE created_at > NOW() - INTERVAL '1 day'`
      );

      reports.daily = {
        logins: dailyLogins.rows[0],
        sessions: dailySessions.rows[0],
        activity: dailyActivity.rows[0],
        generated_at: new Date()
      };
    }

    // Weekly report
    if (report_type === 'all' || report_type === 'weekly') {
      const weeklyLogins = await pool.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN success = true THEN 1 END) as successful,
                COUNT(CASE WHEN success = false THEN 1 END) as failed
         FROM login_attempts
         WHERE created_at > NOW() - INTERVAL '7 days'`
      );

      const weeklySessions = await pool.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled
         FROM mentorship_sessions
         WHERE created_at > NOW() - INTERVAL '7 days'`
      );

      const weeklyActivity = await pool.query(
        `SELECT COUNT(*) as total_events,
                COUNT(DISTINCT user_id) as active_users
         FROM analytics_events
         WHERE created_at > NOW() - INTERVAL '7 days'`
      );

      reports.weekly = {
        logins: weeklyLogins.rows[0],
        sessions: weeklySessions.rows[0],
        activity: weeklyActivity.rows[0],
        generated_at: new Date()
      };
    }

    // Monthly report
    if (report_type === 'all' || report_type === 'monthly') {
      const monthlyLogins = await pool.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN success = true THEN 1 END) as successful,
                COUNT(CASE WHEN success = false THEN 1 END) as failed
         FROM login_attempts
         WHERE created_at > NOW() - INTERVAL '30 days'`
      );

      const monthlySessions = await pool.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled
         FROM mentorship_sessions
         WHERE created_at > NOW() - INTERVAL '30 days'`
      );

      const monthlyActivity = await pool.query(
        `SELECT COUNT(*) as total_events,
                COUNT(DISTINCT user_id) as active_users
         FROM analytics_events
         WHERE created_at > NOW() - INTERVAL '30 days'`
      );

      reports.monthly = {
        logins: monthlyLogins.rows[0],
        sessions: monthlySessions.rows[0],
        activity: monthlyActivity.rows[0],
        generated_at: new Date()
      };
    }

    res.json({ success: true, reports });
  } catch (error) {
    console.error('Generate reports error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   POST /api/analytics/nudges/:id/action
// @desc    Handle nudge action (connect or decline)
// @access  Private
router.post('/nudges/:id/action', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { action } = req.body; // 'connect' or 'decline'

    if (!action || !['connect', 'decline'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    // Get nudge details
    const nudgeResult = await pool.query(
      `SELECT * FROM help_nudges WHERE id = $1 AND user_id = $2`,
      [req.params.id, decoded.id]
    );

    if (nudgeResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Nudge not found' });
    }

    const nudge = nudgeResult.rows[0];

    // Update nudge with action
    await pool.query(
      `UPDATE help_nudges
       SET action_taken = $1, action_taken_at = CURRENT_TIMESTAMP,
           is_dismissed = CASE WHEN $1 = 'decline' THEN true ELSE is_dismissed END
       WHERE id = $2`,
      [action, req.params.id]
    );

    if (action === 'connect') {
      // Find available mentors for this module
      const mentorsResult = await pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.email,
                u.reputation_score, u.activity_score,
                um.grade, um.semester_completed
         FROM users u
         JOIN user_modules um ON u.id = um.user_id
         WHERE u.user_type = 'mentor'
           AND u.is_mentor_verified = true
           AND um.module_id = $1
           AND um.is_verified = true
           AND um.can_teach = true
         ORDER BY u.reputation_score DESC, u.activity_score DESC
         LIMIT 10`,
        [nudge.module_id]
      );

      res.json({
        success: true,
        message: 'Action recorded. Showing available mentors.',
        mentors: mentorsResult.rows
      });
    } else {
      res.json({
        success: true,
        message: 'Nudge declined'
      });
    }
  } catch (error) {
    console.error('Nudge action error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
