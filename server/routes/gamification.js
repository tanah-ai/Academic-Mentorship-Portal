const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { protect, isAdmin } = require('../middleware/auth');

// @route   GET /api/gamification/badges
// @desc    Get all available badges
// @access  Private
router.get('/badges', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM badges ORDER BY points DESC'
    );

    res.json({ success: true, badges: result.rows });
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/gamification/user-badges
// @desc    Get user's earned badges
// @access  Private
router.get('/user-badges', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      `SELECT b.id, b.name, b.description, b.icon, b.points, b.requirement_type, b.requirement_value,
              ub.earned_at
       FROM user_badges ub
       JOIN badges b ON ub.badge_id = b.id
       WHERE ub.user_id = $1
       ORDER BY ub.earned_at DESC`,
      [decoded.id]
    );

    res.json({ success: true, badges: result.rows });
  } catch (error) {
    console.error('Get user badges error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   POST /api/gamification/check-badges
// @desc    Check and award badges based on user achievements
// @access  Private
router.post('/check-badges', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId = decoded.id;
    const newBadges = [];

    // Get all badges
    const badgesResult = await pool.query('SELECT * FROM badges');
    const badges = badgesResult.rows;

    // Get user's current badges
    const userBadgesResult = await pool.query(
      'SELECT badge_id FROM user_badges WHERE user_id = $1',
      [userId]
    );
    const userBadgeIds = userBadgesResult.rows.map(row => row.badge_id);

    // Get user stats
    const userStats = await pool.query(
      'SELECT total_sessions, reputation_score FROM users WHERE id = $1',
      [userId]
    );
    const stats = userStats.rows[0];

    // Check each badge
    for (const badge of badges) {
      if (userBadgeIds.includes(badge.id)) continue; // Already earned

      let earned = false;

      switch (badge.requirement_type) {
        case 'sessions_completed':
          if (stats.total_sessions >= badge.requirement_value) earned = true;
          break;

        case 'rating_average':
          // Calculate average rating
          const avgRatingResult = await pool.query(
            `SELECT AVG(rating) as avg_rating FROM feedback 
             WHERE to_user_id = $1`,
            [userId]
          );
          const avgRating = parseFloat(avgRatingResult.rows[0]?.avg_rating || 0);
          if (avgRating >= badge.requirement_value) earned = true;
          break;

        case 'positive_feedback':
          const positiveFeedbackResult = await pool.query(
            `SELECT COUNT(*) as count FROM feedback 
             WHERE to_user_id = $1 AND rating >= 4`,
            [userId]
          );
          if (parseInt(positiveFeedbackResult.rows[0].count) >= badge.requirement_value) earned = true;
          break;

        case 'modules_variety':
          const modulesResult = await pool.query(
            `SELECT COUNT(DISTINCT module_id) as count FROM mentorship_sessions 
             WHERE mentor_id = $1 AND status = 'completed'`,
            [userId]
          );
          if (parseInt(modulesResult.rows[0].count) >= badge.requirement_value) earned = true;
          break;

        case 'late_sessions':
          const lateSessionsResult = await pool.query(
            `SELECT COUNT(*) as count FROM mentorship_sessions 
             WHERE mentor_id = $1 AND status = 'completed' 
             AND EXTRACT(HOUR FROM completed_at) >= 22`,
            [userId]
          );
          if (parseInt(lateSessionsResult.rows[0].count) >= badge.requirement_value) earned = true;
          break;

        case 'quick_response':
          // This would be tracked separately when mentors respond to requests
          // For now, we'll skip this check
          break;
      }

      if (earned) {
        await pool.query(
          'INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2)',
          [userId, badge.id]
        );
        newBadges.push(badge);
      }
    }

    res.json({ 
      success: true, 
      new_badges: newBadges,
      message: newBadges.length > 0 ? `You earned ${newBadges.length} new badge(s)!` : 'No new badges earned'
    });
  } catch (error) {
    console.error('Check badges error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/gamification/leaderboard
// @desc    Get mentor leaderboard
// @access  Private
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 10, faculty } = req.query;

    let query = `
      SELECT u.id, u.student_id, u.first_name, u.last_name, u.faculty,
             u.reputation_score, u.total_sessions,
             COUNT(DISTINCT ub.badge_id) as badge_count
      FROM users u
      LEFT JOIN user_badges ub ON u.id = ub.user_id
      WHERE u.user_type = 'mentor' AND u.is_mentor_verified = true
    `;
    const params = [];
    let paramCount = 1;

    if (faculty) {
      query += ` AND u.faculty = $${paramCount++}`;
      params.push(faculty);
    }

    query += `
      GROUP BY u.id
      ORDER BY u.reputation_score DESC, u.total_sessions DESC
      LIMIT $${paramCount++}
    `;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    res.json({ success: true, leaderboard: result.rows });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/gamification/certificate/:user_id
// @desc    Generate certificate for mentor
// @access  Private
router.get('/certificate/:user_id', async (req, res) => {
  try {
    const userId = req.params.user_id;

    // Get user details
    const userResult = await pool.query(
      `SELECT student_id, first_name, last_name, faculty, total_sessions, reputation_score
       FROM users 
       WHERE id = $1 AND user_type = 'mentor' AND is_mentor_verified = true`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Mentor not found or not verified' });
    }

    const user = userResult.rows[0];

    // Get badge count
    const badgeCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM user_badges WHERE user_id = $1',
      [userId]
    );
    const badgeCount = parseInt(badgeCountResult.rows[0].count);

    // Generate certificate data
    const certificate = {
      mentor_name: `${user.first_name} ${user.last_name}`,
      student_id: user.student_id,
      faculty: user.faculty,
      total_sessions: user.total_sessions,
      reputation_score: user.reputation_score,
      badges_earned: badgeCount,
      issue_date: new Date().toISOString(),
      certificate_id: `AMP-${userId.substring(0, 8)}-${Date.now()}`,
      verification_url: `${process.env.CLIENT_URL}/verify/${userId}`
    };

    res.json({ success: true, certificate });
  } catch (error) {
    console.error('Generate certificate error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/gamification/stats/:user_id
// @desc    Get user gamification statistics
// @access  Private
router.get('/stats/:user_id', async (req, res) => {
  try {
    const userId = req.params.user_id;

    // Get basic stats
    const userResult = await pool.query(
      'SELECT reputation_score, total_sessions FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const stats = userResult.rows[0];

    // Get badge count
    const badgeCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM user_badges WHERE user_id = $1',
      [userId]
    );
    stats.badge_count = parseInt(badgeCountResult.rows[0].count);

    // Get average rating received
    const avgRatingResult = await pool.query(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as total_feedback
       FROM feedback 
       WHERE to_user_id = $1`,
      [userId]
    );
    stats.average_rating = parseFloat(avgRatingResult.rows[0]?.avg_rating || 0);
    stats.total_feedback = parseInt(avgRatingResult.rows[0]?.total_feedback || 0);

    // Get sessions by status
    const sessionsByStatusResult = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM mentorship_sessions
       WHERE mentee_id = $1 OR mentor_id = $1
       GROUP BY status`,
      [userId]
    );
    stats.sessions_by_status = sessionsByStatusResult.rows;

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Get gamification stats error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   POST /api/gamification/award-badge
// @desc    Admin manually award a badge to a user
// @access  Private (Admin only)
router.post('/award-badge', protect, isAdmin, async (req, res) => {
  try {
    const { user_id, badge_id } = req.body;

    if (!user_id || !badge_id) {
      return res.status(400).json({ success: false, error: 'User ID and Badge ID are required' });
    }

    // Check if user exists and is a mentor
    const userResult = await pool.query(
      'SELECT id, first_name, last_name FROM users WHERE id = $1 AND user_type = \'mentor\'',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Mentor not found' });
    }

    // Check if badge exists
    const badgeResult = await pool.query(
      'SELECT id, name FROM badges WHERE id = $1',
      [badge_id]
    );

    if (badgeResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Badge not found' });
    }

    // Check if user already has this badge
    const existingBadge = await pool.query(
      'SELECT id FROM user_badges WHERE user_id = $1 AND badge_id = $2',
      [user_id, badge_id]
    );

    if (existingBadge.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'User already has this badge' });
    }

    // Award the badge
    await pool.query(
      'INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2)',
      [user_id, badge_id]
    );

    res.json({ 
      success: true, 
      message: `Badge "${badgeResult.rows[0].name}" awarded to ${userResult.rows[0].first_name} ${userResult.rows[0].last_name}`
    });
  } catch (error) {
    console.error('Award badge error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/gamification/mentors-with-badges
// @desc    Get all mentors with their badges (for admin)
// @access  Private (Admin only)
router.get('/mentors-with-badges', protect, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.student_id, u.first_name, u.last_name, u.faculty, u.total_sessions, u.reputation_score,
              COUNT(DISTINCT ub.badge_id) as badge_count,
              array_agg(DISTINCT jsonb_build_object('id', b.id, 'name', b.name, 'icon', b.icon, 'points', b.points)) as badges
       FROM users u
       LEFT JOIN user_badges ub ON u.id = ub.user_id
       LEFT JOIN badges b ON ub.badge_id = b.id
       WHERE u.user_type = 'mentor' AND u.is_mentor_verified = true
       GROUP BY u.id
       ORDER BY u.reputation_score DESC`
    );

    res.json({ success: true, mentors: result.rows });
  } catch (error) {
    console.error('Get mentors with badges error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   DELETE /api/gamification/revoke-badge
// @desc    Admin revoke a badge from a user
// @access  Private (Admin only)
router.delete('/revoke-badge', protect, isAdmin, async (req, res) => {
  try {
    const { user_id, badge_id } = req.body;

    if (!user_id || !badge_id) {
      return res.status(400).json({ success: false, error: 'User ID and Badge ID are required' });
    }

    // Check if the badge exists for this user
    const existingBadge = await pool.query(
      'SELECT id FROM user_badges WHERE user_id = $1 AND badge_id = $2',
      [user_id, badge_id]
    );

    if (existingBadge.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Badge not found for this user' });
    }

    // Revoke the badge
    await pool.query(
      'DELETE FROM user_badges WHERE user_id = $1 AND badge_id = $2',
      [user_id, badge_id]
    );

    res.json({ success: true, message: 'Badge revoked successfully' });
  } catch (error) {
    console.error('Revoke badge error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
