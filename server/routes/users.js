const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { protect, isAdmin } = require('../middleware/auth');

// @route   GET /api/users
// @desc    Get all registered users (admin only), with optional search & pagination
// @access  Private/Admin
router.get('/', protect, isAdmin, async (req, res) => {
  try {
    const { search, user_type, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(parseInt(page), 1) - 1) * parseInt(limit);

    const conditions = [];
    const params = [];
    let paramCount = 1;

    if (search) {
      conditions.push(
        `(first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR student_id ILIKE $${paramCount})`
      );
      params.push(`%${search}%`);
      paramCount++;
    }

    if (user_type) {
      conditions.push(`user_type = $${paramCount}`);
      params.push(user_type);
      paramCount++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      params
    );

    params.push(parseInt(limit), offset);
    const result = await pool.query(
      `SELECT id, student_id, email, first_name, last_name, user_type, faculty, campus, phone,
              is_verified, is_mentor_verified, student_level, year_of_study, msu_verified,
              reputation_score, total_sessions, created_at, last_login
       FROM users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );

    res.json({
      success: true,
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

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

    // Get user modules if mentor (only teachable modules)
    let modules = [];
    if (user.user_type === 'mentor') {
      const modulesResult = await pool.query(
        `SELECT um.id, um.grade, um.semester_completed, um.year_completed, um.is_verified, um.can_teach,
                m.module_code, m.module_name, m.faculty, m.level
         FROM user_modules um
         JOIN modules m ON um.module_id = m.id
         WHERE um.user_id = $1 AND um.can_teach = true`,
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
  body('student_id').optional().notEmpty(),
  body('email').optional().isEmail().withMessage('Please include a valid email'),
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

    const { first_name, last_name, student_id, email, faculty, campus, phone, data_lite_mode } = req.body;

    // Validate student_id format if provided
    if (student_id) {
      const studentIdRegex = /^R\d{6}[A-Z]$/i;
      if (!studentIdRegex.test(student_id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Student ID must be in format R + year + number + letter (e.g., R234567A)' 
        });
      }
    }

    // Check if student_id already exists for another user
    if (student_id) {
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE student_id = $1 AND id != $2',
        [student_id, decoded.id]
      );
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ success: false, error: 'Student ID already in use' });
      }
    }

    // Validate email domain if provided
    if (email && !email.endsWith('@students.msu.ac.zw')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email must be a valid MSU student email (@students.msu.ac.zw)' 
      });
    }

    // Check if email already exists for another user
    if (email) {
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, decoded.id]
      );
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ success: false, error: 'Email already in use' });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (student_id) {
      updates.push(`student_id = $${paramCount++}`);
      values.push(student_id);
    }
    if (first_name) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(first_name);
    }
    if (last_name) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(last_name);
    }
    if (email) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
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

// @route   DELETE /api/users/:id
// @desc    Delete a user (admin only)
// @access  Private/Admin
router.delete('/:id', protect, isAdmin, async (req, res) => {
  try {
    console.log('Attempting to delete user:', req.params.id);
    
    // Delete the user directly
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    console.log('User deleted successfully:', result.rows[0]);
    
    res.json({ 
      success: true, 
      message: 'User deleted successfully',
      deletedUser: result.rows[0]
    });
  } catch (error) {
    console.error('Delete user error:', error);
    console.error('Error details:', error.message);
    console.error('Error code:', error.code);
    res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
});

module.exports = router;
