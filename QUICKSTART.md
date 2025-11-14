# Quick Start Guide

This guide will help you get the Speech-to-Text Summarization Server up and running in under 5 minutes.

## Prerequisites

- Docker (version 20.10+)
- Docker Compose (version 2.0+)
- OpenAI API Key ([Get one here](https://platform.openai.com/api-keys))

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ai_test_01
```

### 2. Configure OpenAI API Key

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```bash
# Open .env with your favorite editor
nano .env  # or vim, code, etc.

# Update this line:
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. Start the Application

```bash
docker-compose up --build
```

Wait for all services to start (approximately 1-2 minutes). You should see:

```
✓ postgres started
✓ redis started
✓ api started
✓ worker started
```

### 4. Access the Application

Open your browser and navigate to:

**http://localhost:3000**

You should see the web interface with an upload form.

## Testing the Application

### Using the Web Interface

1. Click on the upload area or drag and drop an audio file
2. Supported formats: `.wav`, `.mp3` (max 25MB)
3. Click "Upload and Process"
4. Watch the real-time progress bar
5. Click "View Details" to see the transcript and summary

### Using cURL (API)

#### Upload an audio file:

```bash
curl -X POST http://localhost:3000/api/jobs \
  -F "audio=@/path/to/your/audio.mp3"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc-123-def-456",
    "status": "pending",
    "fileName": "audio.mp3"
  }
}
```

#### Check job status:

```bash
curl http://localhost:3000/api/jobs/abc-123-def-456
```

#### Stream real-time progress:

```bash
curl -N http://localhost:3000/api/jobs/abc-123-def-456/stream
```

## API Endpoints Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/jobs` | Upload audio file |
| `GET` | `/api/jobs` | List all jobs |
| `GET` | `/api/jobs/:id` | Get job details |
| `GET` | `/api/jobs/:id/stream` | Real-time progress (SSE) |
| `DELETE` | `/api/jobs/:id` | Delete job |
| `GET` | `/health` | Health check |

## Sample Audio Files for Testing

If you don't have audio files to test with, you can:

1. **Record a voice memo** on your phone and transfer it
2. **Use text-to-speech tools** to generate test audio:
   - https://ttsmaker.com/
   - https://www.naturalreaders.com/online/
3. **Download sample audio** from free sound libraries

## Troubleshooting

### "Container failed to start"

```bash
# Check logs
docker-compose logs api
docker-compose logs worker

# Restart services
docker-compose down
docker-compose up --build
```

### "OpenAI API Error"

- Verify your API key in `.env` is correct
- Check if you have API credits: https://platform.openai.com/account/usage
- Make sure there are no extra spaces in the `.env` file

### "Port 3000 already in use"

Edit `.env` and change the port:

```env
PORT=8080
```

Then restart:

```bash
docker-compose down
docker-compose up
```

### "Database connection failed"

```bash
# Reset everything
docker-compose down -v
docker-compose up --build
```

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check [ARCHITECTURE.md](ARCHITECTURE.md) for system design details
- Explore the API with tools like Postman or Insomnia

## Stopping the Application

```bash
# Stop all services (keep data)
docker-compose down

# Stop and remove all data
docker-compose down -v
```

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | API server port |
| `OPENAI_API_KEY` | (required) | Your OpenAI API key |
| `MAX_FILE_SIZE` | 26214400 | Max upload size (25MB) |
| `JOB_ATTEMPTS` | 3 | Max retry attempts |

## Support

If you encounter any issues:

1. Check the logs: `docker-compose logs`
2. Verify your `.env` configuration
3. Make sure Docker is running
4. Check the [README.md](README.md) troubleshooting section

---

**Happy transcribing!** 🎙️✨
