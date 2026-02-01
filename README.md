# GLEE Human UI

A web app that lets a human play GLEE economic games (bargaining, negotiation, persuasion) against an AI, with AI-assisted message/offer writing.

## Architecture

```
Browser (React)  <──WebSocket──>  FastAPI Backend  <──HTTP /chat──>  GLEE subprocess
                                       │                                  │
                                       │                          GLEE HTTPPlayer
                                       │                          POSTs to backend
                                       │
                                  AI Assistant ──> LLM API (optional)
```

**Key idea**: GLEE's `HTTPPlayer` posts to `/session/{id}/chat` and blocks. Our backend holds the request (using `asyncio.Event`) until the human submits their action through the browser, then returns the response to GLEE.

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- GLEE repository cloned at `../GLEE` (relative to this directory)
- An AI model server running (e.g., the LoRA HTTP server from TTRM)

### Development

```bash
# 1. Install & start everything
bash scripts/start_dev.sh

# 2. Open http://localhost:3000
# 3. Configure a game and play!
```

### With AI Server

```bash
# Start AI + UI together (requires GPU for the model)
bash scripts/start_with_ai.sh --model google/gemma-2-2b-it --device cuda
```

### Manual Start

```bash
# Terminal 1: AI server (in TTRM root)
python -m src.self_play.lora_http_server --model google/gemma-2-2b-it --port 5001

# Terminal 2: Backend
cd backend
pip install -e .
uvicorn main:app --port 8080 --reload

# Terminal 3: Frontend
cd frontend
npm install
npm run dev
```

## Game Setup

When starting a game, you configure:

| Parameter | Description | Options |
|-----------|-------------|---------|
| Game Family | Type of economic game | Bargaining (others coming soon) |
| Player Role | Alice (proposes first) or Bob | Alice, Bob |
| Money to divide | Total amount at stake | $100, $10K, $1M |
| Max rounds | Rounds before timeout | 6, 12, 99 |
| Delta (Alice/Bob) | Discount factor per round | 0.8, 0.9, 0.95, 1.0 |
| Complete information | Both players see both deltas | Yes/No |
| Messages allowed | Free-text messages with offers | Yes/No |

## Features

- **Real-time play** via WebSocket — see AI responses as they come
- **Split slider** — drag to set your proposed split
- **Let AI split** — AI suggests a strategic split based on game context
- **Let AI write** — AI drafts a persuasive message for you
- **Tone modifiers** — adjust AI writing style (more/less credible, logical, aggressive, emotional)
- **Decision view** — clear Accept/Reject UI when receiving offers
- **Game result** — summary of outcome and payoffs

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/games` | POST | Create & launch a game |
| `/api/games` | GET | List all games |
| `/api/games/{id}` | GET | Game state |
| `/api/games/{id}/respond` | POST | Submit human action (REST) |
| `/api/games/{id}/ai-suggest` | POST | Get AI suggestion |
| `/session/{id}/chat` | POST | GLEE HTTPPlayer endpoint (internal) |
| `/ws/{id}` | WS | Real-time game updates |

## Project Structure

```
GLEE_human_UI/
├── backend/
│   ├── main.py           # FastAPI entry point
│   ├── config.py         # Settings
│   ├── models.py         # Pydantic models
│   ├── glee_bridge.py    # Core: async bridge between GLEE and human
│   ├── game_launcher.py  # Launch GLEE subprocess
│   ├── game_manager.py   # Session lifecycle
│   ├── ws_manager.py     # WebSocket connections
│   └── ai_assistant.py   # "Let AI split/write" logic
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── types.ts
│       ├── api.ts
│       ├── hooks/
│       │   ├── useWebSocket.ts
│       │   └── useGameState.ts
│       └── components/
│           ├── GameSetup.tsx
│           ├── GameBoard.tsx
│           ├── ChatHistory.tsx
│           ├── InflationBar.tsx
│           ├── SplitSlider.tsx
│           ├── MessagePanel.tsx
│           ├── ToneChips.tsx
│           ├── ActionButtons.tsx
│           ├── DecisionPanel.tsx
│           └── GameResult.tsx
└── scripts/
    ├── start_dev.sh
    └── start_with_ai.sh
```
