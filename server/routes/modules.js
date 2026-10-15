const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');

// @route   GET /api/modules
// @desc    Get all modules
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { faculty, level, semester } = req.query;

    let query = 'SELECT * FROM modules WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (faculty) {
      query += ` AND faculty = $${paramCount++}`;
      params.push(faculty);
    }

    if (level) {
      query += ` AND level = $${paramCount++}`;
      params.push(level);
    }

    if (semester) {
      query += ` AND semester = $${paramCount++}`;
      params.push(semester);
    }

    query += ' ORDER BY module_code';

    const result = await pool.query(query, params);

    res.json({ success: true, modules: result.rows });
  } catch (error) {
    console.error('Get modules error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/modules/:id
// @desc    Get module by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM modules WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    // Get available mentors for this module
    const mentorsResult = await pool.query(
      `SELECT u.id, u.student_id, u.first_name, u.last_name, u.reputation_score, u.total_sessions
       FROM users u
       JOIN user_modules um ON u.id = um.user_id
       WHERE um.module_id = $1 AND u.is_mentor_verified = true AND um.is_verified = true
       ORDER BY u.reputation_score DESC`,
      [req.params.id]
    );

    res.json({
      success: true,
      module: result.rows[0],
      mentors: mentorsResult.rows
    });
  } catch (error) {
    console.error('Get module error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   POST /api/modules
// @desc    Create a new module (admin only)
// @access  Private
router.post('/', [
  body('module_code').notEmpty().withMessage('Module code is required'),
  body('module_name').notEmpty().withMessage('Module name is required'),
  body('faculty').notEmpty().withMessage('Faculty is required'),
  body('level').isInt({ min: 1, max: 5 }).withMessage('Level must be between 1 and 5'),
  body('semester').notEmpty().withMessage('Semester is required'),
  body('credits').isInt({ min: 1 }).withMessage('Credits must be a positive integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { module_code, module_name, faculty, level, semester, credits, description } = req.body;

    // Check if module code already exists
    const existingModule = await pool.query(
      'SELECT id FROM modules WHERE module_code = $1',
      [module_code]
    );

    if (existingModule.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Module code already exists' });
    }

    const result = await pool.query(
      `INSERT INTO modules (module_code, module_name, faculty, level, semester, credits, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [module_code, module_name, faculty, level, semester, credits, description]
    );

    res.status(201).json({ success: true, module: result.rows[0] });
  } catch (error) {
    console.error('Create module error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   POST /api/modules/user-modules
// @desc    Add module to user's expertise (mentors only)
// @access  Private
router.post('/user-modules', [
  body('module_code').notEmpty().withMessage('Module code is required'),
  body('grade').notEmpty().withMessage('Grade is required'),
  body('semester_completed').notEmpty().withMessage('Semester completed is required'),
  body('year_completed').isInt().withMessage('Year completed must be an integer')
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

    const { module_code, grade, semester_completed, year_completed } = req.body;

    // Get module ID
    const moduleResult = await pool.query(
      'SELECT id FROM modules WHERE module_code = $1',
      [module_code]
    );

    if (moduleResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    const module_id = moduleResult.rows[0].id;

    const userResult = await pool.query(
      'SELECT user_type, is_mentor_verified FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].user_type !== 'mentor') {
      return res.status(403).json({ success: false, error: 'Only mentors can add expertise modules' });
    }

    const isVerified = userResult.rows[0].is_mentor_verified;

    // Check if user already has this module
    const existingUserModule = await pool.query(
      'SELECT id FROM user_modules WHERE user_id = $1 AND module_id = $2',
      [decoded.id, module_id]
    );

    if (existingUserModule.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Module already added to user profile' });
    }

    const result = await pool.query(
      `INSERT INTO user_modules (user_id, module_id, grade, semester_completed, year_completed, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [decoded.id, module_id, grade, semester_completed, year_completed, isVerified]
    );

    res.status(201).json({ success: true, userModule: result.rows[0] });
  } catch (error) {
    console.error('Add user module error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/modules/search
// @desc    Search modules by code or name
// @access  Private
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });
    }

    const result = await pool.query(
      `SELECT * FROM modules 
       WHERE module_code ILIKE $1 OR module_name ILIKE $1
       ORDER BY module_code
       LIMIT 20`,
      [`%${q}%`]
    );

    res.json({ success: true, modules: result.rows });
  } catch (error) {
    console.error('Search modules error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   DELETE /api/modules/:id
// @desc    Delete a module (admin only)
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user is admin
    if (decoded.user_type !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const result = await pool.query(
      'DELETE FROM modules WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    res.json({ success: true, message: 'Module deleted successfully' });
  } catch (error) {
    console.error('Delete module error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
