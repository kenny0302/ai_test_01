const { JobModel } = require('../models/database');
const { getJob } = require('../services/queue');
const { queueEvents } = require('../services/queue');

/**
 * Stream job progress using Server-Sent Events (SSE)
 */
async function streamJobProgress(req, res) {
  const { id } = req.params;

  try {
    // Check if job exists
    const job = await JobModel.findById(id);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', jobId: id })}\n\n`);

    // Send current status
    const sendStatus = async () => {
      const currentJob = await JobModel.findById(id);
      const queueJob = await getJob(id);

      if (currentJob) {
        res.write(`data: ${JSON.stringify({
          type: 'status',
          jobId: id,
          status: currentJob.status,
          progress: currentJob.progress || (queueJob?.progress || 0),
          transcript: currentJob.transcript,
          summary: currentJob.summary,
          errorMessage: currentJob.error_message,
          updatedAt: currentJob.updated_at,
        })}\n\n`);
      }
    };

    // Send initial status
    await sendStatus();

    // Set up interval to poll for updates
    const pollInterval = setInterval(async () => {
      try {
        await sendStatus();

        // Check if job is completed or failed
        const currentJob = await JobModel.findById(id);
        if (currentJob && (currentJob.status === 'completed' || currentJob.status === 'failed')) {
          res.write(`data: ${JSON.stringify({ type: 'done', status: currentJob.status })}\n\n`);
          clearInterval(pollInterval);
          res.end();
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    }, 1000); // Poll every second

    // Listen for queue events
    const progressListener = ({ jobId, data }) => {
      if (jobId === id) {
        res.write(`data: ${JSON.stringify({
          type: 'progress',
          jobId: id,
          progress: data,
        })}\n\n`);
      }
    };

    const completedListener = ({ jobId }) => {
      if (jobId === id) {
        sendStatus().then(() => {
          res.write(`data: ${JSON.stringify({ type: 'done', status: 'completed' })}\n\n`);
          clearInterval(pollInterval);
          res.end();
        });
      }
    };

    const failedListener = ({ jobId, failedReason }) => {
      if (jobId === id) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          jobId: id,
          error: failedReason,
        })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', status: 'failed' })}\n\n`);
        clearInterval(pollInterval);
        res.end();
      }
    };

    // Attach event listeners
    queueEvents.on('progress', progressListener);
    queueEvents.on('completed', completedListener);
    queueEvents.on('failed', failedListener);

    // Clean up on client disconnect
    req.on('close', () => {
      console.log(`SSE connection closed for job ${id}`);
      clearInterval(pollInterval);
      queueEvents.off('progress', progressListener);
      queueEvents.off('completed', completedListener);
      queueEvents.off('failed', failedListener);
      res.end();
    });
  } catch (error) {
    console.error('Error in SSE stream:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message,
    })}\n\n`);
    res.end();
  }
}

module.exports = {
  streamJobProgress,
};
