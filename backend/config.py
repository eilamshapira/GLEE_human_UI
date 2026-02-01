"""Configuration for GLEE Human UI backend."""

import os
from pathlib import Path

# Paths
BACKEND_DIR = Path(__file__).parent
PROJECT_DIR = BACKEND_DIR.parent
# TTRM root is one level above GLEE_human_UI
TTRM_DIR = PROJECT_DIR.parent
GLEE_DIR = TTRM_DIR / "GLEE"

# Python executable for running GLEE subprocess
# GLEE needs pandas, etc. which live in the TTRM venv, not the backend venv.
_ttrm_venv_python = TTRM_DIR / ".venv" / "bin" / "python3"
GLEE_PYTHON = str(_ttrm_venv_python) if _ttrm_venv_python.exists() else "python3"

# Server
BACKEND_HOST = os.getenv("BACKEND_HOST", "0.0.0.0")
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8080"))

# AI opponent server
DEFAULT_AI_SERVER_URL = os.getenv("AI_SERVER_URL", "http://localhost:5001")

# GLEE game settings
DEFAULT_GAME_TIMEOUT = 1800  # 30 min max per game (human is slow)
DEFAULT_GLEE_HTTP_TIMEOUT = 600  # 10 min per HTTP request

# AI assistant (for "Let AI write" / "Let AI split")
AI_ASSISTANT_MODEL = os.getenv("AI_ASSISTANT_MODEL", "vertex_ai/gemini-2.0-flash")

# GLEE experiment name prefix for human games
HUMAN_GAME_EXPERIMENT_PREFIX = "human_ui"
