require('dotenv').config();
const { validateEnvironment } = require('../utils/env-validator');

// Validate environment variables on startup
validateEnvironment();

const config = {
  // Server configuration
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // PostgreSQL configuration
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'stt_summarizer',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
  },

  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  // OpenAI configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },

  // Upload configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '26214400', 10), // 25MB default
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'audio/wav,audio/mpeg,audio/mp3').split(','),
    uploadDir: './uploads',
  },

  // Job configuration
  job: {
    attempts: parseInt(process.env.JOB_ATTEMPTS || '3', 10),
    backoffDelay: parseInt(process.env.JOB_BACKOFF_DELAY || '5000', 10),
  },
};

module.exports = config;
