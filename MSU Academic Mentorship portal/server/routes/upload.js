const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { protect, isAdmin } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'transcript-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents are allowed'));
    }
  }
});

// @route   POST /api/upload/transcript
// @desc    Upload transcript for verification
// @access  Private
router.post('/transcript', protect, upload.single('transcript'), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Check if user already has a pending verification
    const existingVerification = await pool.query(
      `SELECT id FROM transcript_verifications 
       WHERE user_id = $1 AND verification_status = 'pending' AND is_purged = false`,
      [decoded.id]
    );

    if (existingVerification.rows.length > 0) {
      // Delete old file
      const oldVerification = await pool.query(
        'SELECT file_path FROM transcript_verifications WHERE id = $1',
        [existingVerification.rows[0].id]
      );
      if (oldVerification.rows[0]?.file_path && fs.existsSync(oldVerification.rows[0].file_path)) {
        fs.unlinkSync(oldVerification.rows[0].file_path);
      }

      // Update old record
      await pool.query(
        `UPDATE transcript_verifications 
         SET file_path = $1, file_name = $2, file_size = $3, upload_date = CURRENT_TIMESTAMP, verification_status = 'pending'
         WHERE id = $4`,
        [req.file.path, req.file.originalname, req.file.size, existingVerification.rows[0].id]
      );

      res.json({
        success: true,
        message: 'Transcript uploaded successfully',
        verification_id: existingVerification.rows[0].id
      });
    } else {
      // Create new verification record
      const result = await pool.query(
        `INSERT INTO transcript_verifications (user_id, file_path, file_name, file_size, verification_status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING id`,
        [decoded.id, req.file.path, req.file.originalname, req.file.size]
      );

      res.status(201).json({
        success: true,
        message: 'Transcript uploaded successfully',
        verification_id: result.rows[0].id
      });
    }
  } catch (error) {
    console.error('Upload transcript error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/upload/verification-status
// @desc    Get transcript verification status
// @access  Private
router.get('/verification-status', protect, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      `SELECT id, verification_status, upload_date, verification_date, rejection_reason, is_purged
       FROM transcript_verifications
       WHERE user_id = $1
       ORDER BY upload_date DESC
       LIMIT 1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, verification: null });
    }

    res.json({ success: true, verification: result.rows[0] });
  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   POST /api/upload/verify/:id
// @desc    Verify transcript (admin only)
// @access  Private
router.post('/verify/:id', protect, isAdmin, [
  body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected'),
  body('rejection_reason').optional()
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

    const { status, rejection_reason } = req.body;

    // Get verification record
    const verificationResult = await pool.query(
      'SELECT * FROM transcript_verifications WHERE id = $1',
      [req.params.id]
    );

    if (verificationResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Verification not found' });
    }

    const verification = verificationResult.rows[0];

    // Update verification status
    await pool.query(
      `UPDATE transcript_verifications 
       SET verification_status = $1, verified_by = $2, verification_date = CURRENT_TIMESTAMP, rejection_reason = $3
       WHERE id = $4`,
      [status, decoded.id, rejection_reason || null, req.params.id]
    );

    // If approved, check MSU mentor eligibility criteria before marking as verified
    if (status === 'approved') {
      // Get user's student level
      const userResult = await pool.query(
        'SELECT student_level FROM users WHERE id = $1',
        [verification.user_id]
      );
      const user = userResult.rows[0];

      // Check if user is Level 2 or above
      if (!user || user.student_level < 2) {
        return res.status(400).json({ 
          success: false, 
          error: 'Mentor must be Level 2 or above to be verified' 
        });
      }

      // Check user's grades (must have at least 6 Distinctions, 6 2.1s, and 2.2s, no 3s)
      const gradesResult = await pool.query(
        'SELECT grade FROM user_modules WHERE user_id = $1',
        [verification.user_id]
      );
      
      const grades = gradesResult.rows.map(row => row.grade.toUpperCase());
      
      // Count grade types
      const distinctions = grades.filter(g => g === 'A' || g === 'DISTINCTION' || g === 'D').length;
      const firstClass = grades.filter(g => g === '2.1' || g === 'FIRST CLASS').length;
      const secondClass = grades.filter(g => g === '2.2' || g === 'SECOND CLASS').length;
      const fails = grades.filter(g => g === '3' || g === 'FAIL' || g === 'F').length;

      // MSU Mentor Eligibility Criteria
      if (distinctions < 6) {
        return res.status(400).json({ 
          success: false, 
          error: `Mentor must have at least 6 Distinctions. Currently has ${distinctions}.` 
        });
      }

      if (firstClass < 6) {
        return res.status(400).json({ 
          success: false, 
          error: `Mentor must have at least 6 2.1 grades. Currently has ${firstClass}.` 
        });
      }

      if (secondClass < 1) {
        return res.status(400).json({ 
          success: false, 
          error: `Mentor must have at least 1 2.2 grade. Currently has ${secondClass}.` 
        });
      }

      if (fails > 0) {
        return res.status(400).json({ 
          success: false, 
          error: `Mentor cannot have any 3 (fail) grades. Currently has ${fails}.` 
        });
      }

      // All criteria met - mark user as mentor verified
      await pool.query(
        'UPDATE users SET is_mentor_verified = true WHERE id = $1',
        [verification.user_id]
      );

      // Purge the file after verification for security
      if (verification.file_path && fs.existsSync(verification.file_path)) {
        fs.unlinkSync(verification.file_path);
      }

      await pool.query(
        'UPDATE transcript_verifications SET is_purged = true, file_path = NULL WHERE id = $1',
        [req.params.id]
      );
    }

    res.json({ success: true, message: `Transcript ${status} successfully` });
  } catch (error) {
    console.error('Verify transcript error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/upload/pending-verifications
// @desc    Get all pending verifications (admin only)
// @access  Private
router.get('/pending-verifications', protect, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tv.id, tv.upload_date, tv.file_name, tv.file_size,
              u.student_id, u.first_name, u.last_name, u.email
       FROM transcript_verifications tv
       JOIN users u ON tv.user_id = u.id
       WHERE tv.verification_status = 'pending' AND tv.is_purged = false
       ORDER BY tv.upload_date ASC`
    );

    res.json({ success: true, verifications: result.rows });
  } catch (error) {
    console.error('Get pending verifications error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
