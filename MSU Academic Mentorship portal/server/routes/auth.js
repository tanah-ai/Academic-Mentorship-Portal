const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('student_id').notEmpty().withMessage('Student ID is required'),
  body('email').isEmail().withMessage('Please include a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be 6 or more characters'),
  body('first_name').notEmpty().withMessage('First name is required'),
  body('last_name').notEmpty().withMessage('Last name is required'),
  body('user_type').isIn(['mentee', 'mentor']).withMessage('User type must be mentee or mentor'),
  body('student_level').optional().isInt({ min: 1, max: 4 }).withMessage('Student level must be between 1 and 4'),
  body('year_of_study').optional().isInt({ min: 1, max: 4 }).withMessage('Year of study must be between 1 and 4')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { student_id, email, password, first_name, last_name, user_type, faculty, campus, phone, student_level, year_of_study } = req.body;

    // MSU Directory Validation (simulated - in production, integrate with actual MSU student directory)
    // MSU student ID format: R + 2 digits (year of enrollment) + 4 digits (registration number) + 1 letter
    // Example: R234567A (23 = 2023, 4567 = registration number, A = letter)
    const studentIdPattern = /^R\d{6}[A-Z]$/; // MSU student ID format: RYYNNNNA
    if (!studentIdPattern.test(student_id)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid MSU student ID format. Format: R + 2-digit year + 4-digit number + letter (e.g., R234567A)' 
      });
    }

    // Validate email domain (MSU students use @students.msu.ac.zw)
    if (!email.endsWith('@students.msu.ac.zw')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Registration is only available for MSU students with @students.msu.ac.zw email addresses' 
      });
    }

    // If registering as mentor, must be Level 2 or above
    if (user_type === 'mentor' && student_level && student_level < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Mentors must be Level 2 or above' 
      });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE student_id = $1 OR email = $2',
      [student_id, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Insert user with MSU-specific fields
    const result = await pool.query(
      `INSERT INTO users (student_id, email, password_hash, first_name, last_name, user_type, faculty, campus, phone, student_level, year_of_study, msu_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, student_id, email, first_name, last_name, user_type, is_verified, is_mentor_verified, student_level, year_of_study, msu_verified`,
      [student_id, email, password_hash, first_name, last_name, user_type, faculty, campus, phone, student_level || 1, year_of_study || 1, true]
    );

    const user = result.rows[0];

    // Create token
    const token = jwt.sign(
      { id: user.id, user_type: user.user_type },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        student_id: user.student_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        user_type: user.user_type,
        is_verified: user.is_verified,
        is_mentor_verified: user.is_mentor_verified,
        student_level: user.student_level,
        year_of_study: user.year_of_study,
        msu_verified: user.msu_verified
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().withMessage('Please include a valid email'),
  body('password').exists().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    // Check for user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Create token
    const token = jwt.sign(
      { id: user.id, user_type: user.user_type },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        student_id: user.student_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        user_type: user.user_type,
        is_verified: user.is_verified,
        is_mentor_verified: user.is_mentor_verified,
        reputation_score: user.reputation_score,
        data_lite_mode: user.data_lite_mode
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', async (req, res) => {
  try {
    // This would normally use the protect middleware, but for simplicity we'll get user from token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      'SELECT id, student_id, email, first_name, last_name, user_type, faculty, campus, phone, is_verified, is_mentor_verified, reputation_score, total_sessions, data_lite_mode FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
