#!/bin/bash

# ============================================
# Speech-to-Text Summarization Demo Script
# ============================================
#
# This script demonstrates the full workflow of:
# 1. Uploading an audio file
# 2. Monitoring job progress via SSE
# 3. Retrieving the final results (transcript + summary)
#
# Prerequisites:
# - API server running on localhost:3000
# - harvard.wav file in the project root
#
# Usage: ./demo.sh
# ============================================

# Removed set -e to handle errors more gracefully

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="http://localhost:3000"
AUDIO_FILE="./harvard.wav"

# Print formatted message
print_header() {
    echo -e "\n${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}\n"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if API server is running
check_server() {
    print_header "Step 0: Health Check"
    print_info "Checking if API server is running..."

    if curl -s "$API_BASE_URL/health" > /dev/null 2>&1; then
        print_success "API server is running at $API_BASE_URL"

        # Display health status
        echo -e "\n${YELLOW}Health Status:${NC}"
        curl -s "$API_BASE_URL/health" | jq '.'
    else
        print_error "API server is not running at $API_BASE_URL"
        print_info "Please start the server with: docker-compose up"
        exit 1
    fi
}

# Check if audio file exists
check_audio_file() {
    print_header "Step 1: Validate Audio File"

    if [ ! -f "$AUDIO_FILE" ]; then
        print_error "Audio file not found: $AUDIO_FILE"
        exit 1
    fi

    FILE_SIZE=$(stat -f%z "$AUDIO_FILE" 2>/dev/null || stat -c%s "$AUDIO_FILE" 2>/dev/null)
    FILE_SIZE_MB=$(echo "scale=2; $FILE_SIZE / 1024 / 1024" | bc)

    print_success "Found audio file: $AUDIO_FILE"
    print_info "File size: ${FILE_SIZE_MB} MB"
}

# Upload audio file
upload_audio() {
    print_header "Step 2: Upload Audio File"
    print_info "Uploading $AUDIO_FILE to API server..."

    RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/jobs" \
        -F "audio=@$AUDIO_FILE")

    # Check if response is valid JSON
    if ! echo "$RESPONSE" | jq empty 2>/dev/null; then
        print_error "Invalid response from server!"
        echo "$RESPONSE"
        exit 1
    fi

    # Check if upload was successful
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success')

    if [ "$SUCCESS" != "true" ]; then
        print_error "Upload failed!"
        echo "$RESPONSE" | jq '.'
        exit 1
    fi

    # Extract job ID
    UPLOAD_JOB_ID=$(echo "$RESPONSE" | jq -r '.data.id')

    print_success "Upload successful!"
    print_info "Job ID: ${YELLOW}$UPLOAD_JOB_ID${NC}"

    echo -e "\n${YELLOW}Response:${NC}"
    echo "$RESPONSE" | jq '.'

    # Return job ID via a global variable instead of echo
    # This avoids output capture issues
    echo "$UPLOAD_JOB_ID"
}

# Monitor job progress via polling
monitor_job_polling() {
    local JOB_ID=$1
    print_header "Step 3: Monitor Job Progress (Polling)"

    if [ -z "$JOB_ID" ]; then
        print_error "No Job ID provided to monitor_job_polling"
        exit 1
    fi

    print_info "Monitoring Job ID: $JOB_ID"
    print_info "Polling job status every 2 seconds..."

    local MAX_ATTEMPTS=60  # Maximum 2 minutes
    local ATTEMPT=0

    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        ATTEMPT=$((ATTEMPT + 1))

        RESPONSE=$(curl -s "$API_BASE_URL/api/jobs/$JOB_ID")

        # Check if response is valid JSON
        if ! echo "$RESPONSE" | jq empty 2>/dev/null; then
            print_warning "Invalid JSON response (attempt $ATTEMPT/$MAX_ATTEMPTS)"
            sleep 2
            continue
        fi

        STATUS=$(echo "$RESPONSE" | jq -r '.data.status // "unknown"')
        PROGRESS=$(echo "$RESPONSE" | jq -r '.data.progress // 0')

        print_info "Status: ${YELLOW}$STATUS${NC} | Progress: ${GREEN}${PROGRESS}%${NC}"

        # Check if job is completed or failed
        if [ "$STATUS" == "completed" ]; then
            print_success "Job completed!"
            return 0
        elif [ "$STATUS" == "failed" ]; then
            print_error "Job failed!"
            ERROR_MSG=$(echo "$RESPONSE" | jq -r '.data.errorMessage // "Unknown error"')
            print_error "Error: $ERROR_MSG"
            exit 1
        elif [ "$STATUS" == "unknown" ]; then
            print_warning "Job status unknown, retrying..."
        fi

        sleep 2
    done

    print_error "Timeout: Job did not complete within $((MAX_ATTEMPTS * 2)) seconds"
    exit 1
}

# Monitor job progress via SSE (alternative method)
monitor_job_sse() {
    local JOB_ID=$1
    print_header "Step 3 (Alternative): Monitor Job Progress (SSE)"

    print_info "Connecting to SSE stream..."
    print_warning "Press Ctrl+C to stop streaming (job will continue processing)"

    echo ""

    # Use curl with -N flag for no buffering
    curl -N -s "$API_BASE_URL/api/jobs/$JOB_ID/stream" | while IFS= read -r line; do
        # Skip empty lines
        if [ -z "$line" ]; then
            continue
        fi

        # Parse SSE data
        if [[ $line == data:* ]]; then
            DATA="${line#data:}"

            # Extract event type
            EVENT_TYPE=$(echo "$DATA" | jq -r '.type // "unknown"')

            case $EVENT_TYPE in
                "connected")
                    print_success "Connected to SSE stream"
                    ;;
                "status")
                    STATUS=$(echo "$DATA" | jq -r '.status')
                    PROGRESS=$(echo "$DATA" | jq -r '.progress // 0')
                    print_info "Status: ${YELLOW}$STATUS${NC} | Progress: ${GREEN}${PROGRESS}%${NC}"
                    ;;
                "done")
                    STATUS=$(echo "$DATA" | jq -r '.status')
                    print_success "Job completed with status: $STATUS"
                    break
                    ;;
                "error")
                    ERROR=$(echo "$DATA" | jq -r '.error')
                    print_error "Error: $ERROR"
                    break
                    ;;
            esac
        fi
    done
}

# Retrieve final results
get_results() {
    local JOB_ID=$1
    print_header "Step 4: Retrieve Results"

    print_info "Fetching final results for job $JOB_ID..."

    RESPONSE=$(curl -s "$API_BASE_URL/api/jobs/$JOB_ID")

    # Extract data
    TRANSCRIPT=$(echo "$RESPONSE" | jq -r '.data.transcript')
    SUMMARY=$(echo "$RESPONSE" | jq -r '.data.summary')
    FILE_NAME=$(echo "$RESPONSE" | jq -r '.data.fileName')
    CREATED_AT=$(echo "$RESPONSE" | jq -r '.data.createdAt')

    print_success "Results retrieved successfully!"

    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}File:${NC} $FILE_NAME"
    echo -e "${YELLOW}Created:${NC} $CREATED_AT"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    echo -e "\n${GREEN}📝 TRANSCRIPT:${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "$TRANSCRIPT"

    echo -e "\n${GREEN}📋 SUMMARY:${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "$SUMMARY"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Get queue metrics
get_metrics() {
    print_header "Step 5: Queue Metrics"

    print_info "Fetching queue metrics..."

    METRICS=$(curl -s "$API_BASE_URL/api/queue/metrics")

    echo -e "\n${YELLOW}Queue Metrics:${NC}"
    echo "$METRICS" | jq '.'
}

# List all jobs
list_jobs() {
    print_header "Bonus: List All Jobs"

    print_info "Fetching all jobs..."

    JOBS=$(curl -s "$API_BASE_URL/api/jobs")

    echo -e "\n${YELLOW}All Jobs:${NC}"
    echo "$JOBS" | jq '.data[] | {id, status, fileName, progress, createdAt}'
}

# Main execution
main() {
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════════╗"
    echo "║  Speech-to-Text Summarization Demo            ║"
    echo "║  Testing with harvard.wav                      ║"
    echo "╚════════════════════════════════════════════════╝"
    echo -e "${NC}"

    # Step 0: Health check
    check_server

    # Step 1: Check audio file
    check_audio_file

    # Step 2: Upload audio
    JOB_ID=$(upload_audio | tail -1)  # Only capture the last line (Job ID)

    # Validate JOB_ID
    if [ -z "$JOB_ID" ] || [ "$JOB_ID" == "null" ]; then
        print_error "Failed to capture Job ID from upload"
        exit 1
    fi

    print_info "Captured Job ID: $JOB_ID"

    # Wait a moment for job to be queued
    sleep 2

    # Step 3: Monitor progress
    # Choose monitoring method:
    # Option A: Polling (uncomment to use)
    monitor_job_polling "$JOB_ID"

    # Option B: SSE streaming (uncomment to use instead of polling)
    # monitor_job_sse "$JOB_ID"

    # Step 4: Get results
    get_results "$JOB_ID"

    # Step 5: Show metrics
    get_metrics

    # Bonus: List all jobs
    list_jobs

    print_header "Demo Complete!"
    print_success "All steps executed successfully!"
    echo -e "${GREEN}Job ID: ${YELLOW}$JOB_ID${NC}\n"
}

# Check for jq (JSON parser)
if ! command -v jq &> /dev/null; then
    print_error "jq is not installed. Please install it first:"
    echo "  - macOS: brew install jq"
    echo "  - Ubuntu: sudo apt-get install jq"
    exit 1
fi

# Run main function
main
