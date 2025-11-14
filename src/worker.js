const { Worker } = require('bullmq');
const fs = require('fs');
const path = require('path');
const { connection } = require('./services/queue');
const { transcribeAudioWithRetry, validateAudioFile } = require('./services/stt');
const { generateSummaryWithRetry } = require('./services/llm');
const { JobModel } = require('./models/database');
const config = require('./config');

/**
 * Process audio job
 */
async function processAudioJob(job) {
  const { id, filePath, fileName } = job.data;

  console.log(`Processing job ${id}: ${fileName}`);

  try {
    // Update job status to processing
    await JobModel.updateStatus(id, 'processing', { progress: 0 });
    await job.updateProgress(0);

    // Step 1: Validate audio file
    console.log(`Validating audio file: ${filePath}`);
    await validateAudioFile(filePath);
    await job.updateProgress(10);

    // Step 2: Transcribe audio using STT
    console.log(`Starting transcription for job ${id}`);
    await job.updateProgress(20);

    const transcript = await transcribeAudioWithRetry(filePath, {
      model: 'whisper-1',
      temperature: 0,
    });

    if (!transcript) {
      throw new Error('Transcription returned empty result');
    }

    // Save transcript to database
    await JobModel.updateTranscript(id, transcript);
    console.log(`Transcript saved for job ${id}`);
    await job.updateProgress(50);

    // Step 3: Generate summary using LLM
    console.log(`Starting summary generation for job ${id}`);
    await job.updateProgress(60);

    const summary = await generateSummaryWithRetry(transcript, {
      model: 'gpt-4o-mini',
      temperature: 0.7,
    });

    if (!summary) {
      throw new Error('Summary generation returned empty result');
    }

    // Save summary to database
    await JobModel.updateSummary(id, summary);
    console.log(`Summary saved for job ${id}`);
    await job.updateProgress(100);

    // Cleanup: Optionally delete the uploaded file after processing
    // Uncomment the following lines if you want to delete files after processing
    // try {
    //   fs.unlinkSync(filePath);
    //   console.log(`Deleted file: ${filePath}`);
    // } catch (err) {
    //   console.error(`Failed to delete file: ${filePath}`, err);
    // }

    return {
      id,
      status: 'completed',
      transcript,
      summary,
    };
  } catch (error) {
    console.error(`Job ${id} failed:`, error);

    // Update job status to failed
    await JobModel.updateStatus(id, 'failed', {
      errorMessage: error.message,
    });

    throw error;
  }
}

// Create worker instance
const worker = new Worker('audio-processing', processAudioJob, {
  connection,
  concurrency: 2, // Process up to 2 jobs simultaneously
  limiter: {
    max: 10, // Maximum number of jobs processed
    duration: 60000, // Per 60 seconds
  },
});

// Worker event handlers
worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error:`, err.message);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

worker.on('active', (job) => {
  console.log(`Job ${job.id} is now active`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await worker.close();
  await connection.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await worker.close();
  await connection.quit();
  process.exit(0);
});

console.log('Worker started and waiting for jobs...');
console.log(`Worker configuration: concurrency=${worker.opts.concurrency}`);

module.exports = worker;
