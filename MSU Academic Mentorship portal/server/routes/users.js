const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');

// @route   GET /api/users/profile
// @desc    Get user profile with modules
// @access  Private
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user profile
    const userResult = await pool.query(
      `SELECT id, student_id, email, first_name, last_name, user_type, faculty, campus, phone, 
              is_verified, is_mentor_verified, reputation_score, total_sessions, data_lite_mode, created_at
       FROM users WHERE id = $1`,
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get user modules if mentor
    let modules = [];
    if (user.user_type === 'mentor') {
      const modulesResult = await pool.query(
        `SELECT um.id, um.grade, um.semester_completed, um.year_completed, um.is_verified,
                m.module_code, m.module_name, m.faculty, m.level
         FROM user_modules um
         JOIN modules m ON um.module_id = m.id
         WHERE um.user_id = $1`,
        [decoded.id]
      );
      modules = modulesResult.rows;
    }

    // Get user badges
    const badgesResult = await pool.query(
      `SELECT b.name, b.description, b.icon, b.points, ub.earned_at
       FROM user_badges ub
       JOIN badges b ON ub.badge_id = b.id
       WHERE ub.user_id = $1
       ORDER BY ub.earned_at DESC`,
      [decoded.id]
    );

    res.json({
      success: true,
      user,
      modules,
      badges: badgesResult.rows
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  body('first_name').optional().notEmpty(),
  body('last_name').optional().notEmpty(),
  body('faculty').optional().notEmpty(),
  body('campus').optional().notEmpty(),
  body('phone').optional().notEmpty()
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

    const { first_name, last_name, faculty, campus, phone, data_lite_mode } = req.body;

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (first_name) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(first_name);
    }
    if (last_name) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(last_name);
    }
    if (faculty) {
      updates.push(`faculty = $${paramCount++}`);
      values.push(faculty);
    }
    if (campus) {
      updates.push(`campus = $${paramCount++}`);
      values.push(campus);
    }
    if (phone) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }
    if (data_lite_mode !== undefined) {
      updates.push(`data_lite_mode = $${paramCount++}`);
      values.push(data_lite_mode);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    values.push(decoded.id);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({
      success: true,
      user: {
        id: result.rows[0].id,
        student_id: result.rows[0].student_id,
        email: result.rows[0].email,
        first_name: result.rows[0].first_name,
        last_name: result.rows[0].last_name,
        user_type: result.rows[0].user_type,
        faculty: result.rows[0].faculty,
        campus: result.rows[0].campus,
        phone: result.rows[0].phone,
        data_lite_mode: result.rows[0].data_lite_mode
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/users/mentors
// @desc    Get all verified mentors
// @access  Private
router.get('/mentors', async (req, res) => {
  try {
    const { module_code, faculty } = req.query;

    let query = `
      SELECT u.id, u.student_id, u.first_name, u.last_name, u.faculty, u.campus, 
             u.reputation_score, u.total_sessions
      FROM users u
      WHERE u.user_type = 'mentor' AND u.is_mentor_verified = true
    `;
    const params = [];
    let paramCount = 1;

    if (module_code) {
      query += ` AND EXISTS (
        SELECT 1 FROM user_modules um
        JOIN modules m ON um.module_id = m.id
        WHERE um.user_id = u.id AND m.module_code = $${paramCount++}
      )`;
      params.push(module_code);
    }

    if (faculty) {
      query += ` AND u.faculty = $${paramCount++}`;
      params.push(faculty);
    }

    query += ' ORDER BY u.reputation_score DESC';

    const result = await pool.query(query, params);

    res.json({ success: true, mentors: result.rows });
  } catch (error) {
    console.error('Get mentors error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID (public profile)
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, student_id, first_name, last_name, user_type, faculty, campus, 
              reputation_score, total_sessions, is_mentor_verified
       FROM users WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = result.rows[0];

    // Get mentor modules if applicable
    if (user.user_type === 'mentor' && user.is_mentor_verified) {
      const modulesResult = await pool.query(
        `SELECT m.module_code, m.module_name, m.faculty, m.level, um.grade
         FROM user_modules um
         JOIN modules m ON um.module_id = m.id
         WHERE um.user_id = $1 AND um.is_verified = true`,
        [req.params.id]
      );
      user.modules = modulesResult.rows;
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
