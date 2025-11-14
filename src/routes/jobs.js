const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const {
  createJob,
  getJobById,
  getAllJobs,
  deleteJob,
} = require('../controllers/jobController');
const { streamJobProgress } = require('../controllers/sseController');
const { validateUUID, validateJobQuery } = require('../utils/validators');

const router = express.Router();

// Ensure upload directory exists
if (!fs.existsSync(config.upload.uploadDir)) {
  fs.mkdirSync(config.upload.uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.upload.uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = config.upload.allowedTypes;
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
});

// Routes

/**
 * POST /api/jobs
 * Create a new transcription job
 */
router.post('/', upload.single('audio'), createJob);

/**
 * GET /api/jobs
 * Get all jobs (with optional filters)
 */
router.get('/', validateJobQuery, getAllJobs);

/**
 * GET /api/jobs/:id/stream
 * Stream job progress using Server-Sent Events (SSE)
 */
router.get('/:id/stream', validateUUID, streamJobProgress);

/**
 * GET /api/jobs/:id
 * Get a specific job by ID
 */
router.get('/:id', validateUUID, getJobById);

/**
 * DELETE /api/jobs/:id
 * Delete a job by ID
 */
router.delete('/:id', validateUUID, deleteJob);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large',
        message: `Maximum file size is ${config.upload.maxFileSize / 1024 / 1024}MB`,
      });
    }
    return res.status(400).json({
      success: false,
      error: 'File upload error',
      message: error.message,
    });
  }
  next(error);
});

module.exports = router;
