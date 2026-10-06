const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { sendRegistrationEmail } = require('../utils/emailService');

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('student_id')
    .notEmpty().withMessage('Student ID is required')
    .trim()
    .escape(),
  body('email')
    .isEmail().withMessage('Please include a valid email')
    .normalizeEmail()
    .toLowerCase(),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password must contain at least one special character'),
  body('first_name')
    .notEmpty().withMessage('First name is required')
    .trim()
    .escape()
    .isLength({ max: 50 }).withMessage('First name must be less than 50 characters'),
  body('last_name')
    .notEmpty().withMessage('Last name is required')
    .trim()
    .escape()
    .isLength({ max: 50 }).withMessage('Last name must be less than 50 characters'),
  body('user_type')
    .isIn(['mentee', 'mentor']).withMessage('User type must be mentee or mentor')
    .trim(),
  body('faculty')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 100 }).withMessage('Faculty name must be less than 100 characters'),
  body('campus')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 100 }).withMessage('Campus name must be less than 100 characters'),
  body('phone')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 20 }).withMessage('Phone number must be less than 20 characters'),
  body('student_level')
    .optional()
    .isInt({ min: 1, max: 4 }).withMessage('Student level must be between 1 and 4'),
  body('year_of_study')
    .optional()
    .isInt({ min: 1, max: 4 }).withMessage('Year of study must be between 1 and 4')
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

    // Hash password with increased salt rounds for better security
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert user with MSU-specific fields
    const result = await pool.query(
      `INSERT INTO users (student_id, email, password_hash, first_name, last_name, user_type, faculty, campus, phone, student_level, year_of_study, msu_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, student_id, email, first_name, last_name, user_type, is_verified, is_mentor_verified, student_level, year_of_study, msu_verified`,
      [student_id, email, password_hash, first_name, last_name, user_type, faculty, campus, phone, student_level || 1, year_of_study || 1, true]
    );

    const user = result.rows[0];

    // Send registration email (don't block response if email fails)
    sendRegistrationEmail(user.email, user.first_name, user.last_name).catch(err => {
      console.error('Failed to send registration email:', err);
    });

    // Create token with shorter expiration for security
    const token = jwt.sign(
      { id: user.id, user_type: user.user_type },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '1h' }
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

    const { email, password, selectedRole } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    // Check for user
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingTime = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(423).json({ 
        success: false, 
        error: `Account is locked. Please try again in ${remainingTime} minutes.` 
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      // Increment failed login attempts
      const failedAttempts = (user.failed_login_attempts || 0) + 1;
      
      if (failedAttempts >= 5) {
        // Lock account for 30 minutes
        const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
        await pool.query(
          'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
          [failedAttempts, lockedUntil, user.id]
        );
        return res.status(423).json({ 
          success: false, 
          error: 'Too many failed login attempts. Account locked for 30 minutes.' 
        });
      }
      
      await pool.query(
        'UPDATE users SET failed_login_attempts = $1 WHERE id = $2',
        [failedAttempts, user.id]
      );
      
      const remainingAttempts = 5 - failedAttempts;
      return res.status(401).json({ 
        success: false, 
        error: `Invalid credentials. ${remainingAttempts} attempts remaining before account lockout.` 
      });
    }

    // Reset failed login attempts on successful login
    await pool.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
      [user.id]
    );

    // Validate selected role matches actual user type
    console.log('Login attempt - selectedRole:', selectedRole, 'user_type:', user.user_type);
    if (selectedRole) {
      if (selectedRole === 'admin' && user.user_type !== 'admin') {
        console.log('Blocking admin login - user is not admin');
        return res.status(403).json({ 
          success: false, 
          error: 'Access denied. You are not registered as an admin.' 
        });
      }
      if (selectedRole === 'user' && user.user_type === 'admin') {
        console.log('Blocking user login - user is admin');
        return res.status(403).json({ 
          success: false, 
          error: 'Access denied. Admins must use the admin login option.' 
        });
      }
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Create token with shorter expiration for security
    const token = jwt.sign(
      { id: user.id, user_type: user.user_type },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '1h' }
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
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', [
  body('currentPassword').exists().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password must contain at least one special character'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Password confirmation does not match');
    }
    return true;
  })
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { currentPassword, newPassword } = req.body;

    // Get user
    const result = await pool.query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = result.rows[0];

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (isSamePassword) {
      return res.status(400).json({ success: false, error: 'New password must be different from current password' });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, user.id]
    );

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
