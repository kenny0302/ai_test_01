const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { JobModel } = require('../models/database');
const { addJob, getJob, getQueueMetrics } = require('../services/queue');
const config = require('../config');

/**
 * Create a new transcription job
 */
async function createJob(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file uploaded',
      });
    }

    // Generate job ID
    const jobId = uuidv4();

    // Prepare job data
    const jobData = {
      id: jobId,
      status: 'pending',
      filePath: req.file.path,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    };

    // Save job to database
    const job = await JobModel.create(jobData);

    // Add job to queue
    await addJob({
      id: jobId,
      filePath: req.file.path,
      fileName: req.file.originalname,
    });

    res.status(201).json({
      success: true,
      data: {
        id: job.id,
        status: job.status,
        fileName: job.file_name,
        fileSize: job.file_size,
        createdAt: job.created_at,
      },
      message: 'Job created successfully and queued for processing',
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create job',
      message: error.message,
    });
  }
}

/**
 * Get job by ID
 */
async function getJobById(req, res) {
  try {
    const { id } = req.params;

    // Get job from database
    const job = await JobModel.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    // Get queue information if available
    const queueJob = await getJob(id);

    res.json({
      success: true,
      data: {
        id: job.id,
        status: job.status,
        fileName: job.file_name,
        fileSize: job.file_size,
        mimeType: job.mime_type,
        transcript: job.transcript,
        summary: job.summary,
        progress: job.progress || (queueJob?.progress || 0),
        errorMessage: job.error_message,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      },
    });
  } catch (error) {
    console.error('Error getting job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get job',
      message: error.message,
    });
  }
}

/**
 * Get all jobs
 */
async function getAllJobs(req, res) {
  try {
    const { status, limit } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (limit) filters.limit = parseInt(limit, 10);

    const jobs = await JobModel.findAll(filters);

    res.json({
      success: true,
      data: jobs.map(job => ({
        id: job.id,
        status: job.status,
        fileName: job.file_name,
        fileSize: job.file_size,
        progress: job.progress,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      })),
      count: jobs.length,
    });
  } catch (error) {
    console.error('Error getting jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get jobs',
      message: error.message,
    });
  }
}

/**
 * Delete job by ID
 */
async function deleteJob(req, res) {
  try {
    const { id } = req.params;

    const job = await JobModel.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    // Delete file if exists
    if (job.file_path && fs.existsSync(job.file_path)) {
      fs.unlinkSync(job.file_path);
    }

    // Delete job from database
    await JobModel.delete(id);

    res.json({
      success: true,
      message: 'Job deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete job',
      message: error.message,
    });
  }
}

/**
 * Get queue metrics
 */
async function getMetrics(req, res) {
  try {
    const metrics = await getQueueMetrics();

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics',
      message: error.message,
    });
  }
}

module.exports = {
  createJob,
  getJobById,
  getAllJobs,
  deleteJob,
  getMetrics,
};
