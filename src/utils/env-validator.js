/**
 * Environment variable validation utility
 */

/**
 * Validate required environment variables
 * @throws {Error} If any required variable is missing
 */
function validateRequiredEnvVars() {
  const requiredVars = [
    'OPENAI_API_KEY',
    'POSTGRES_HOST',
    'POSTGRES_DB',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'REDIS_HOST',
  ];

  const missing = requiredVars.filter(varName => {
    const value = process.env[varName];
    return !value || value.trim() === '';
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file or environment configuration.'
    );
  }
}

/**
 * Validate environment variable values
 * @throws {Error} If any variable has invalid value
 */
function validateEnvValues() {
  const errors = [];

  // Validate PORT
  const port = parseInt(process.env.PORT || '3000', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push('PORT must be a number between 1 and 65535');
  }

  // Validate POSTGRES_PORT
  const pgPort = parseInt(process.env.POSTGRES_PORT || '5432', 10);
  if (isNaN(pgPort) || pgPort < 1 || pgPort > 65535) {
    errors.push('POSTGRES_PORT must be a number between 1 and 65535');
  }

  // Validate REDIS_PORT
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  if (isNaN(redisPort) || redisPort < 1 || redisPort > 65535) {
    errors.push('REDIS_PORT must be a number between 1 and 65535');
  }

  // Validate MAX_FILE_SIZE
  const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '26214400', 10);
  if (isNaN(maxFileSize) || maxFileSize < 1) {
    errors.push('MAX_FILE_SIZE must be a positive number');
  }

  // Validate JOB_ATTEMPTS
  const jobAttempts = parseInt(process.env.JOB_ATTEMPTS || '3', 10);
  if (isNaN(jobAttempts) || jobAttempts < 1 || jobAttempts > 10) {
    errors.push('JOB_ATTEMPTS must be a number between 1 and 10');
  }

  // Validate NODE_ENV
  const nodeEnv = process.env.NODE_ENV || 'development';
  const validEnvs = ['development', 'production', 'test'];
  if (!validEnvs.includes(nodeEnv)) {
    errors.push(`NODE_ENV must be one of: ${validEnvs.join(', ')}`);
  }

  if (errors.length > 0) {
    throw new Error(
      'Invalid environment variable values:\n' +
      errors.map(e => `  - ${e}`).join('\n')
    );
  }
}

/**
 * Validate all environment variables
 * Should be called on application startup
 */
function validateEnvironment() {
  console.log('Validating environment variables...');

  try {
    validateRequiredEnvVars();
    validateEnvValues();
    console.log('✓ Environment validation passed');
  } catch (error) {
    console.error('✗ Environment validation failed:');
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  validateEnvironment,
  validateRequiredEnvVars,
  validateEnvValues,
};
