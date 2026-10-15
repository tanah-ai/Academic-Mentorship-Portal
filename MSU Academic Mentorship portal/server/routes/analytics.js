const express = require('express');
const router = express.Router();
const pool = require('../config/database');

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
    // Find users who might need help based on their search patterns
    // Users who search frequently but don't book sessions
    const strugglingUsersResult = await pool.query(
      `SELECT ae.user_id, ae.module_id, COUNT(*) as search_count,
              m.module_code, m.module_name
       FROM analytics_events ae
       JOIN modules m ON ae.module_id = m.id
       WHERE ae.event_type = 'mentor_search'
         AND ae.created_at > NOW() - INTERVAL '7 days'
         AND NOT EXISTS (
           SELECT 1 FROM mentorship_sessions ms
           WHERE ms.mentee_id = ae.user_id 
             AND ms.module_id = ae.module_id
             AND ms.created_at > NOW() - INTERVAL '7 days'
         )
       GROUP BY ae.user_id, ae.module_id, m.module_code, m.module_name
       HAVING COUNT(*) >= 3
       LIMIT 20`
    );

    const nudgesCreated = [];

    for (const user of strugglingUsersResult.rows) {
      // Check if nudge already exists
      const existingNudge = await pool.query(
        `SELECT id FROM help_nudges 
         WHERE user_id = $1 AND module_id = $2 AND is_sent = false AND is_dismissed = false`,
        [user.user_id, user.module_id]
      );

      if (existingNudge.rows.length === 0) {
        const nudgeResult = await pool.query(
          `INSERT INTO help_nudges (user_id, module_id, nudge_type, message)
           VALUES ($1, $2, 'struggling_detected', $3)
           RETURNING id`,
          [user.user_id, user.module_id, 
           `We noticed you've been searching for help with ${user.module_code}. Would you like to connect with a verified mentor?`]
        );
        nudgesCreated.push(nudgeResult.rows[0].id);
      }
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
        module_demand: moduleDemand.rows,
        recent_activity: recentActivity.rows
      }
    });
  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
