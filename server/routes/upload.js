const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { protect, isMentor, isAdmin } = require('../middleware/auth');
const { parseTranscript } = require('../utils/transcriptParser');

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

// Configure multer for session file uploads
const sessionStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.env.UPLOAD_DIR || './uploads', 'sessions');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'session-' + req.body.sessionId + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const sessionUpload = multer({
  storage: sessionStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB for session files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  }
});

// @route   POST /api/upload/transcript
// @desc    Upload transcript for verification
// @access  Private
router.post('/transcript', protect, isMentor, upload.single('transcript'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    await pool.query(
      'UPDATE users SET is_mentor_verified = false WHERE id = $1',
      [req.user.id]
    );

    // Check if user already has a pending verification
    const existingVerification = await pool.query(
      `SELECT id FROM transcript_verifications 
       WHERE user_id = $1 AND verification_status = 'pending' AND is_purged = false`,
      [req.user.id]
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
        [req.user.id, req.file.path, req.file.originalname, req.file.size]
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
    const result = await pool.query(
      `SELECT id, verification_status, upload_date, verification_date, rejection_reason, is_purged
       FROM transcript_verifications
       WHERE user_id = $1
       ORDER BY upload_date DESC
       LIMIT 1`,
      [req.user.id]
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
    let modulesAdded = 0;
    let teachableCount = 0;

    // Parse the transcript before approving it so all modules are added,
    // but only those with eligible grades (A, 2.1, 2.2) are marked as teachable.
    if (status === 'approved') {
      const catalogueResult = await pool.query(
        'SELECT id, module_code FROM modules'
      );
      const parsedTranscript = await parseTranscript(verification.file_path, catalogueResult.rows);

      console.log('Parsed transcript matches:', parsedTranscript.matches);
      console.log('Total matches:', parsedTranscript.matches.length);
      console.log('Teachable matches:', parsedTranscript.matches.filter(m => m.can_teach));

      if (parsedTranscript.matches.length === 0) {
        return res.status(400).json({
          success: false,
          error: parsedTranscript.textFound
            ? 'No module results were found in the transcript. Upload a transcript with module codes and grades.'
            : 'This transcript is scanned or contains no readable text. Upload a searchable PDF or DOCX transcript so modules and grades can be detected automatically.'
        });
      }

      await pool.query(
        'UPDATE users SET is_mentor_verified = true WHERE id = $1',
        [verification.user_id]
      );

      for (const module of parsedTranscript.matches) {
        await pool.query(
          `INSERT INTO user_modules (user_id, module_id, grade, semester_completed, year_completed, is_verified, can_teach)
           VALUES ($1, $2, $3, $4, $5, true, $6)
           ON CONFLICT (user_id, module_id)
           DO UPDATE SET grade = EXCLUDED.grade, is_verified = true, can_teach = EXCLUDED.can_teach`,
          [verification.user_id, module.module_id, module.grade, module.semester_completed, module.year_completed, module.can_teach]
        );
        if (module.can_teach) teachableCount++;
      }
      modulesAdded = parsedTranscript.matches.length;

      // Purge the file after verification for security
      if (verification.file_path && fs.existsSync(verification.file_path)) {
        fs.unlinkSync(verification.file_path);
      }

      await pool.query(
        'UPDATE transcript_verifications SET is_purged = true, file_path = NULL WHERE id = $1',
        [req.params.id]
      );
    } else {
      await pool.query(
        'UPDATE users SET is_mentor_verified = false WHERE id = $1',
        [verification.user_id]
      );
    }

    await pool.query(
      `UPDATE transcript_verifications
       SET verification_status = $1, verified_by = $2, verification_date = CURRENT_TIMESTAMP, rejection_reason = $3
       WHERE id = $4`,
      [status, decoded.id, rejection_reason || null, req.params.id]
    );

    res.json({
      success: true,
      message: `Transcript ${status} successfully`,
      modules_added: modulesAdded,
      teachable_count: teachableCount
    });
  } catch (error) {
    console.error('Verify transcript error:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    res.status(500).json({ success: false, error: error.message || 'Server error' });
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

// @route   POST /api/upload/session-file
// @desc    Upload file for session sharing
// @access  Private
router.post('/session-file', protect, sessionUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/sessions/${req.file.filename}`;
    
    res.json({
      success: true,
      message: 'File uploaded successfully',
      fileUrl: fileUrl
    });
  } catch (error) {
    console.error('Session file upload error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
