const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// @route   POST /api/sessions
// @desc    Create a new mentorship session
// @access  Private
router.post('/', [
  body('mentor_id').notEmpty().withMessage('Mentor ID is required'),
  body('module_id').notEmpty().withMessage('Module ID is required'),
  body('session_title').notEmpty().withMessage('Session title is required'),
  body('scheduled_date').isISO8601().withMessage('Valid scheduled date is required'),
  body('duration_minutes').optional().isInt({ min: 15, max: 180 })
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

    const { mentor_id, module_id, session_title, description, scheduled_date, duration_minutes } = req.body;

    // Verify mentor exists and is verified
    const mentorResult = await pool.query(
      'SELECT id, is_mentor_verified FROM users WHERE id = $1 AND user_type = $2',
      [mentor_id, 'mentor']
    );

    if (mentorResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Mentor not found' });
    }

    if (!mentorResult.rows[0].is_mentor_verified) {
      return res.status(400).json({ success: false, error: 'Mentor is not verified' });
    }

    // Verify module exists
    const moduleResult = await pool.query(
      'SELECT id FROM modules WHERE id = $1',
      [module_id]
    );

    if (moduleResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    // Generate meeting link
    const meeting_link = `/session/${uuidv4()}`;

    const result = await pool.query(
      `INSERT INTO mentorship_sessions (mentee_id, mentor_id, module_id, session_title, description, scheduled_date, duration_minutes, meeting_link, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')
       RETURNING *`,
      [decoded.id, mentor_id, module_id, session_title, description, scheduled_date, duration_minutes || 60, meeting_link]
    );

    // Track analytics event
    await pool.query(
      `INSERT INTO analytics_events (user_id, event_type, event_data, module_id)
       VALUES ($1, 'session_created', $2, $3)`,
      [decoded.id, JSON.stringify({ session_id: result.rows[0].id }), module_id]
    );

    res.status(201).json({ success: true, session: result.rows[0] });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/sessions
// @desc    Get user's sessions (as mentee or mentor)
// @access  Private
router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { status, role } = req.query;

    let query = `
      SELECT ms.*, 
             m.first_name as mentee_first_name, m.last_name as mentee_last_name,
             ment.first_name as mentor_first_name, ment.last_name as mentor_last_name,
             mod.module_code, mod.module_name
      FROM mentorship_sessions ms
      JOIN users m ON ms.mentee_id = m.id
      JOIN users ment ON ms.mentor_id = ment.id
      JOIN modules mod ON ms.module_id = mod.id
      WHERE (ms.mentee_id = $1 OR ms.mentor_id = $1)
    `;
    const params = [decoded.id];
    let paramCount = 2;

    if (role === 'mentee') {
      query = `
        SELECT ms.*, 
               ment.first_name as mentor_first_name, ment.last_name as mentor_last_name,
               mod.module_code, mod.module_name
        FROM mentorship_sessions ms
        JOIN users ment ON ms.mentor_id = ment.id
        JOIN modules mod ON ms.module_id = mod.id
        WHERE ms.mentee_id = $1
      `;
    } else if (role === 'mentor') {
      query = `
        SELECT ms.*, 
               m.first_name as mentee_first_name, m.last_name as mentee_last_name,
               mod.module_code, mod.module_name
        FROM mentorship_sessions ms
        JOIN users m ON ms.mentee_id = m.id
        JOIN modules mod ON ms.module_id = mod.id
        WHERE ms.mentor_id = $1
      `;
    }

    if (status) {
      query += ` AND ms.status = $${paramCount++}`;
      params.push(status);
    }

    query += ' ORDER BY ms.scheduled_date DESC';

    const result = await pool.query(query, params);

    res.json({ success: true, sessions: result.rows });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/sessions/:id
// @desc    Get session by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ms.*, 
              m.first_name as mentee_first_name, m.last_name as mentee_last_name, m.email as mentee_email,
              ment.first_name as mentor_first_name, ment.last_name as mentor_last_name, ment.email as mentor_email,
              mod.module_code, mod.module_name
       FROM mentorship_sessions ms
       JOIN users m ON ms.mentee_id = m.id
       JOIN users ment ON ms.mentor_id = ment.id
       JOIN modules mod ON ms.module_id = mod.id
       WHERE ms.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    res.json({ success: true, session: result.rows[0] });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   PUT /api/sessions/:id/status
// @desc    Update session status
// @access  Private
router.put('/:id/status', [
  body('status').isIn(['scheduled', 'in_progress', 'completed', 'cancelled']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { status } = req.body;

    const result = await pool.query(
      `UPDATE mentorship_sessions 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       ${status === 'completed' ? ', completed_at = CURRENT_TIMESTAMP' : ''}
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // If completed, update session counts
    if (status === 'completed') {
      await pool.query(
        `UPDATE users SET total_sessions = total_sessions + 1 WHERE id = $1 OR id = $2`,
        [result.rows[0].mentee_id, result.rows[0].mentor_id]
      );
    }

    res.json({ success: true, session: result.rows[0] });
  } catch (error) {
    console.error('Update session status error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   POST /api/sessions/:id/join
// @desc    Join a session
// @access  Private
router.post('/:id/join', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if session exists
    const sessionResult = await pool.query(
      'SELECT * FROM mentorship_sessions WHERE id = $1',
      [req.params.id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Add participant
    try {
      await pool.query(
        'INSERT INTO session_participants (session_id, user_id) VALUES ($1, $2)',
        [req.params.id, decoded.id]
      );
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({ success: false, error: 'Already joined session' });
      }
      throw error;
    }

    res.json({ success: true, message: 'Joined session successfully' });
  } catch (error) {
    console.error('Join session error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   POST /api/sessions/:id/feedback
// @desc    Submit feedback for a session
// @access  Private
router.post('/:id/feedback', [
  body('to_user_id').notEmpty().withMessage('Recipient user ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5')
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

    const { to_user_id, rating, comment } = req.body;

    // Check if session exists
    const sessionResult = await pool.query(
      'SELECT * FROM mentorship_sessions WHERE id = $1',
      [req.params.id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Insert feedback
    const result = await pool.query(
      `INSERT INTO feedback (session_id, from_user_id, to_user_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.params.id, decoded.id, to_user_id, rating, comment]
    );

    // Update recipient's reputation score
    await pool.query(
      `UPDATE users 
       SET reputation_score = reputation_score + $1 
       WHERE id = $2`,
      [rating * 2, to_user_id]
    );

    res.status(201).json({ success: true, feedback: result.rows[0] });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
