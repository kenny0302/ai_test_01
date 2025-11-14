const { Queue, Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');
const config = require('../config');

// Create Redis connection
const connection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null,
});

// Create job queue
const jobQueue = new Queue('audio-processing', {
  connection,
  defaultJobOptions: {
    attempts: config.job.attempts,
    backoff: {
      type: 'exponential',
      delay: config.job.backoffDelay,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

// Queue events for monitoring
const queueEvents = new QueueEvents('audio-processing', { connection });

queueEvents.on('completed', ({ jobId }) => {
  console.log(`Job ${jobId} completed successfully`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`Job ${jobId} failed:`, failedReason);
});

queueEvents.on('progress', ({ jobId, data }) => {
  console.log(`Job ${jobId} progress:`, data);
});

/**
 * Add a new job to the queue
 */
async function addJob(jobData) {
  const job = await jobQueue.add('process-audio', jobData, {
    jobId: jobData.id,
  });
  console.log(`Job ${job.id} added to queue`);
  return job;
}

/**
 * Get job status and data
 */
async function getJob(jobId) {
  const job = await jobQueue.getJob(jobId);
  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress || 0;
  const failedReason = job.failedReason;

  return {
    id: job.id,
    data: job.data,
    state,
    progress,
    failedReason,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  };
}

/**
 * Get queue metrics
 */
async function getQueueMetrics() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    jobQueue.getWaitingCount(),
    jobQueue.getActiveCount(),
    jobQueue.getCompletedCount(),
    jobQueue.getFailedCount(),
    jobQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
  };
}

/**
 * Clean up old jobs
 */
async function cleanQueue(grace = 24 * 3600 * 1000) {
  await jobQueue.clean(grace, 1000, 'completed');
  await jobQueue.clean(grace, 1000, 'failed');
  console.log('Queue cleaned successfully');
}

/**
 * Close connections
 */
async function closeQueue() {
  await jobQueue.close();
  await queueEvents.close();
  await connection.quit();
  console.log('Queue connections closed');
}

module.exports = {
  jobQueue,
  queueEvents,
  addJob,
  getJob,
  getQueueMetrics,
  cleanQueue,
  closeQueue,
  connection,
};
