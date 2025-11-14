const OpenAI = require('openai');
const fs = require('fs');
const config = require('../config');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * Transcribe audio file using OpenAI Whisper API
 * @param {string} filePath - Path to the audio file
 * @param {Object} options - Optional parameters
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudio(filePath, options = {}) {
  try {
    console.log(`Starting transcription for file: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Create read stream for the audio file
    const audioStream = fs.createReadStream(filePath);

    // Call OpenAI Whisper API
    const response = await openai.audio.transcriptions.create({
      file: audioStream,
      model: options.model || 'whisper-1',
      language: options.language || undefined, // Auto-detect if not specified
      response_format: options.responseFormat || 'text',
      temperature: options.temperature || 0,
    });

    console.log(`Transcription completed successfully for: ${filePath}`);

    // Return the transcribed text
    if (typeof response === 'string') {
      return response;
    } else if (response.text) {
      return response.text;
    } else {
      throw new Error('Unexpected response format from Whisper API');
    }
  } catch (error) {
    console.error('Error in transcribeAudio:', error);

    // Handle specific error types
    if (error.response) {
      throw new Error(`OpenAI API Error: ${error.response.status} - ${error.response.data?.error?.message || 'Unknown error'}`);
    } else if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    } else {
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }
}

/**
 * Transcribe audio with retry logic
 * @param {string} filePath - Path to the audio file
 * @param {Object} options - Optional parameters
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudioWithRetry(filePath, options = {}, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await transcribeAudio(filePath, options);
    } catch (error) {
      lastError = error;
      console.error(`Transcription attempt ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Validate audio file before transcription
 * @param {string} filePath - Path to the audio file
 * @returns {Promise<boolean>} - True if valid
 */
async function validateAudioFile(filePath) {
  try {
    const stats = fs.statSync(filePath);

    // Check file size (25MB limit for Whisper API)
    const maxSize = 25 * 1024 * 1024;
    if (stats.size > maxSize) {
      throw new Error(`File size exceeds 25MB limit: ${stats.size} bytes`);
    }

    // Check if file is readable
    fs.accessSync(filePath, fs.constants.R_OK);

    return true;
  } catch (error) {
    console.error('Audio file validation failed:', error);
    throw error;
  }
}

module.exports = {
  transcribeAudio,
  transcribeAudioWithRetry,
  validateAudioFile,
};
