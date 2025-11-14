const { Pool } = require('pg');
const config = require('../config');

// Create PostgreSQL connection pool
const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.database,
  user: config.postgres.user,
  password: config.postgres.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  console.log('Database connected successfully');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(-1);
});

// Job database operations
const JobModel = {
  /**
   * Create a new job
   */
  async create(jobData) {
    const query = `
      INSERT INTO jobs (id, status, file_path, file_name, file_size, mime_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      jobData.id,
      jobData.status || 'pending',
      jobData.filePath,
      jobData.fileName,
      jobData.fileSize,
      jobData.mimeType,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  /**
   * Find job by ID
   */
  async findById(id) {
    const query = 'SELECT * FROM jobs WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  },

  /**
   * Find all jobs with optional filters
   */
  async findAll(filters = {}) {
    let query = 'SELECT * FROM jobs';
    const conditions = [];
    const values = [];

    if (filters.status) {
      conditions.push(`status = $${values.length + 1}`);
      values.push(filters.status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ` LIMIT $${values.length + 1}`;
      values.push(filters.limit);
    }

    const result = await pool.query(query, values);
    return result.rows;
  },

  /**
   * Update job status
   */
  async updateStatus(id, status, additionalData = {}) {
    const updates = ['status = $2'];
    const values = [id, status];
    let paramIndex = 3;

    if (additionalData.progress !== undefined) {
      updates.push(`progress = $${paramIndex}`);
      values.push(additionalData.progress);
      paramIndex++;
    }

    if (additionalData.errorMessage !== undefined) {
      updates.push(`error_message = $${paramIndex}`);
      values.push(additionalData.errorMessage);
      paramIndex++;
    }

    const query = `
      UPDATE jobs
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  /**
   * Update job with transcript
   */
  async updateTranscript(id, transcript) {
    const query = `
      UPDATE jobs
      SET transcript = $2, progress = 50
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id, transcript]);
    return result.rows[0];
  },

  /**
   * Update job with summary
   */
  async updateSummary(id, summary) {
    const query = `
      UPDATE jobs
      SET summary = $2, status = 'completed', progress = 100
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id, summary]);
    return result.rows[0];
  },

  /**
   * Delete job
   */
  async delete(id) {
    const query = 'DELETE FROM jobs WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  },
};

module.exports = {
  pool,
  JobModel,
};
