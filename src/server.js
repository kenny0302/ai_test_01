const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const jobRoutes = require('./routes/jobs');
const { pool } = require('./models/database');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'speech-to-text-summarizer',
      version: '1.0.0',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Speech-to-Text Summarization API',
    version: '1.0.0',
    description: 'API for transcribing audio files and generating summaries',
    endpoints: {
      jobs: {
        'POST /api/jobs': 'Create a new transcription job',
        'GET /api/jobs': 'Get all jobs',
        'GET /api/jobs/:id': 'Get a specific job',
        'GET /api/jobs/:id/stream': 'Stream job progress (SSE)',
        'DELETE /api/jobs/:id': 'Delete a job',
      },
      metrics: {
        'GET /api/queue/metrics': 'Get queue metrics',
      },
      system: {
        'GET /health': 'Health check',
        'GET /api': 'API information',
      },
    },
  });
});

// API routes
app.use('/api/jobs', jobRoutes);

// Serve frontend (if exists)
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Catch-all route for frontend
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../frontend/public/index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({
      success: false,
      error: 'Not found',
      message: 'The requested resource was not found',
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);

  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error',
    ...(config.nodeEnv === 'development' && { stack: error.stack }),
  });
});

// Start server
const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API info: http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

module.exports = app;
