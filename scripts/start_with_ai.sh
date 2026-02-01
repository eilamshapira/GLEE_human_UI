#!/usr/bin/env bash
# Start AI model server + Human UI.
# Usage: bash scripts/start_with_ai.sh [--model MODEL_NAME] [--device DEVICE]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TTRM_DIR="$(dirname "$PROJECT_DIR")"

MODEL="${MODEL:-google/gemma-2-2b-it}"
DEVICE="${DEVICE:-cuda}"
AI_PORT="${AI_PORT:-5001}"

# Parse args
while [[ $# -gt 0 ]]; do
    case $1 in
        --model) MODEL="$2"; shift 2 ;;
        --device) DEVICE="$2"; shift 2 ;;
        --port) AI_PORT="$2"; shift 2 ;;
        *) shift ;;
    esac
done

echo "=== GLEE Human UI + AI Server ==="
echo "Model:  $MODEL"
echo "Device: $DEVICE"
echo "AI port: $AI_PORT"
echo ""

# Start AI server
echo "Starting AI model server..."
cd "$TTRM_DIR"
python -m src.self_play.lora_http_server \
    --model "$MODEL" \
    --device "$DEVICE" \
    --port "$AI_PORT" &
AI_PID=$!

# Wait for AI server to be ready
echo "Waiting for AI server..."
for i in $(seq 1 60); do
    if curl -s "http://localhost:$AI_PORT/health" > /dev/null 2>&1; then
        echo "AI server ready!"
        break
    fi
    sleep 2
done

# Start the dev servers
echo "Starting Human UI..."
bash "$SCRIPT_DIR/start_dev.sh" &
UI_PID=$!

echo ""
echo "AI Server: http://localhost:$AI_PORT"
echo "Backend:   http://localhost:8080"
echo "Frontend:  http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all servers."

trap "kill $AI_PID $UI_PID 2>/dev/null; exit" INT TERM
wait
