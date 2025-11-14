const OpenAI = require('openai');
const config = require('../config');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * Generate summary from transcript using OpenAI GPT
 * @param {string} transcript - The transcribed text
 * @param {Object} options - Optional parameters
 * @returns {Promise<string>} - Generated summary
 */
async function generateSummary(transcript, options = {}) {
  try {
    console.log('Starting summary generation...');

    if (!transcript || transcript.trim().length === 0) {
      throw new Error('Transcript is empty');
    }

    // Prepare the prompt for summarization
    const systemPrompt = options.systemPrompt || `You are a helpful assistant that creates concise and informative summaries of audio transcripts.
Your summaries should:
1. Capture the main points and key information
2. Be well-structured and easy to read
3. Maintain objectivity and accuracy
4. Be approximately 20-30% of the original length`;

    const userPrompt = options.userPrompt || `Please provide a comprehensive summary of the following transcript:\n\n${transcript}`;

    // Call OpenAI Chat Completions API
    const response = await openai.chat.completions.create({
      model: options.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1000,
    });

    const summary = response.choices[0]?.message?.content;

    if (!summary) {
      throw new Error('No summary generated from GPT API');
    }

    console.log('Summary generation completed successfully');
    return summary.trim();
  } catch (error) {
    console.error('Error in generateSummary:', error);

    // Handle specific error types
    if (error.response) {
      throw new Error(`OpenAI API Error: ${error.response.status} - ${error.response.data?.error?.message || 'Unknown error'}`);
    } else {
      throw new Error(`Summary generation failed: ${error.message}`);
    }
  }
}

/**
 * Generate summary with streaming support
 * @param {string} transcript - The transcribed text
 * @param {Function} onChunk - Callback for each chunk
 * @param {Object} options - Optional parameters
 * @returns {Promise<string>} - Complete summary
 */
async function generateSummaryStream(transcript, onChunk, options = {}) {
  try {
    console.log('Starting streaming summary generation...');

    if (!transcript || transcript.trim().length === 0) {
      throw new Error('Transcript is empty');
    }

    const systemPrompt = options.systemPrompt || `You are a helpful assistant that creates concise and informative summaries of audio transcripts.
Your summaries should:
1. Capture the main points and key information
2. Be well-structured and easy to read
3. Maintain objectivity and accuracy
4. Be approximately 20-30% of the original length`;

    const userPrompt = options.userPrompt || `Please provide a comprehensive summary of the following transcript:\n\n${transcript}`;

    // Call OpenAI Chat Completions API with streaming
    const stream = await openai.chat.completions.create({
      model: options.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1000,
      stream: true,
    });

    let fullSummary = '';

    // Process streaming response
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullSummary += content;
        if (onChunk) {
          onChunk(content);
        }
      }
    }

    console.log('Streaming summary generation completed');
    return fullSummary.trim();
  } catch (error) {
    console.error('Error in generateSummaryStream:', error);

    if (error.response) {
      throw new Error(`OpenAI API Error: ${error.response.status} - ${error.response.data?.error?.message || 'Unknown error'}`);
    } else {
      throw new Error(`Streaming summary generation failed: ${error.message}`);
    }
  }
}

/**
 * Generate summary with retry logic
 * @param {string} transcript - The transcribed text
 * @param {Object} options - Optional parameters
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<string>} - Generated summary
 */
async function generateSummaryWithRetry(transcript, options = {}, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateSummary(transcript, options);
    } catch (error) {
      lastError = error;
      console.error(`Summary generation attempt ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

module.exports = {
  generateSummary,
  generateSummaryStream,
  generateSummaryWithRetry,
};
