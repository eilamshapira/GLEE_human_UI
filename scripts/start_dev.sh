#!/usr/bin/env bash
# Start both backend and frontend for development.
# Usage: bash scripts/start_dev.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== GLEE Human UI — Dev Mode ==="

# Install backend deps if needed
if [ ! -d "$PROJECT_DIR/backend/.venv" ]; then
    echo "Setting up backend..."
    cd "$PROJECT_DIR/backend"
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -e .
else
    source "$PROJECT_DIR/backend/.venv/bin/activate"
fi

# Install frontend deps if needed
if [ ! -d "$PROJECT_DIR/frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd "$PROJECT_DIR/frontend"
    npm install
fi

# Start backend in background
echo "Starting backend on :8080..."
cd "$PROJECT_DIR/backend"
uvicorn main:app --host 0.0.0.0 --port 8080 --reload &
BACKEND_PID=$!

# Start frontend
echo "Starting frontend on :3000..."
cd "$PROJECT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8080"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers."

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
