const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const config = require('./config');
const jobRoutes = require('./routes/jobs');
const { pool } = require('./models/database');
const { getMetrics } = require('./controllers/jobController');
const { connection: redisConnection } = require('./services/queue');

const app = express();

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000'];

    if (allowedOrigins.indexOf(origin) !== -1 || config.nodeEnv === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// Middleware
app.use(compression()); // Enable gzip compression
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'speech-to-text-summarizer',
    version: '1.0.0',
    checks: {},
  };

  let isHealthy = true;

  // Check database connection
  try {
    await pool.query('SELECT 1');
    health.checks.database = { status: 'ok', message: 'Connected' };
  } catch (error) {
    health.checks.database = { status: 'failed', message: error.message };
    isHealthy = false;
  }

  // Check Redis connection
  try {
    await redisConnection.ping();
    health.checks.redis = { status: 'ok', message: 'Connected' };
  } catch (error) {
    health.checks.redis = { status: 'failed', message: error.message };
    isHealthy = false;
  }

  // Update overall status
  if (!isHealthy) {
    health.status = 'unhealthy';
  }

  const statusCode = isHealthy ? 200 : 503;
  res.status(statusCode).json(health);
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

// Queue metrics endpoint
app.get('/api/queue/metrics', getMetrics);

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: 'The requested API endpoint was not found',
  });
});

// Serve frontend (if exists)
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Catch-all route for frontend (only non-API routes)
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

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API info: http://localhost:${PORT}/api`);
});

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  console.log(`${signal} received, shutting down gracefully...`);

  // Stop accepting new connections
  server.close(async (err) => {
    if (err) {
      console.error('Error closing server:', err);
    } else {
      console.log('HTTP server closed');
    }

    // Close database connections
    try {
      await pool.end();
      console.log('Database connections closed');
    } catch (error) {
      console.error('Error closing database:', error);
    }

    // Close Redis connection
    try {
      await redisConnection.quit();
      console.log('Redis connection closed');
    } catch (error) {
      console.error('Error closing Redis:', error);
    }

    console.log('Shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

module.exports = app;
