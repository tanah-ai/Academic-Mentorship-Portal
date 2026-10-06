const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from database
      const result = await pool.query(
        'SELECT id, student_id, email, first_name, last_name, user_type, is_verified, is_mentor_verified, reputation_score, data_lite_mode FROM users WHERE id = $1',
        [decoded.id]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, error: 'User not found' });
      }

      req.user = result.rows[0];
      next();
    } catch (error) {
      console.error('Auth error:', error);
      return res.status(401).json({ success: false, error: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authorized, no token' });
  }
};

// Check if user is mentor
const isMentor = (req, res, next) => {
  if (req.user && req.user.user_type === 'mentor') {
    next();
  } else {
    res.status(403).json({ success: false, error: 'Not authorized as mentor' });
  }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.user_type === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, error: 'Not authorized as admin' });
  }
};

// Check if user is verified mentor
const isVerifiedMentor = (req, res, next) => {
  if (req.user && req.user.user_type === 'mentor' && req.user.is_mentor_verified) {
    next();
  } else {
    res.status(403).json({ success: false, error: 'Not authorized as verified mentor' });
  }
};

module.exports = { protect, isMentor, isAdmin, isVerifiedMentor };
