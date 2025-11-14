/**
 * Validation middleware and utility functions
 */

/**
 * Validate UUID format
 * @param {string} uuid - UUID string to validate
 * @returns {boolean} - True if valid UUID v4
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Middleware to validate UUID in request params
 */
function validateUUID(req, res, next) {
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid job ID format',
      message: 'Job ID must be a valid UUID v4 format',
    });
  }

  next();
}

/**
 * Validate job status
 * @param {string} status - Status to validate
 * @returns {boolean} - True if valid status
 */
function isValidStatus(status) {
  const validStatuses = ['pending', 'processing', 'completed', 'failed'];
  return validStatuses.includes(status);
}

/**
 * Middleware to validate query parameters
 */
function validateJobQuery(req, res, next) {
  const { status, limit } = req.query;

  if (status && !isValidStatus(status)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid status',
      message: 'Status must be one of: pending, processing, completed, failed',
    });
  }

  if (limit) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit',
        message: 'Limit must be a number between 1 and 100',
      });
    }
  }

  next();
}

module.exports = {
  isValidUUID,
  validateUUID,
  isValidStatus,
  validateJobQuery,
};
