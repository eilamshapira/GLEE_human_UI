"""
Game Launcher — starts GLEE as a subprocess.

Creates a config JSON and runs `python GLEE/main.py -c config.json -n 1`.
The human player URL points back to our backend so GLEE's HTTPPlayer
POSTs to /session/{session_id}/chat.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Optional

from config import GLEE_DIR, DEFAULT_GAME_TIMEOUT, DEFAULT_GLEE_HTTP_TIMEOUT, HUMAN_GAME_EXPERIMENT_PREFIX


def build_glee_config(
    session_id: str,
    game_family: str,
    player_role: str,
    ai_server_url: str,
    backend_url: str,
    game_args: dict[str, Any],
    delta_1: float,
    delta_2: float,
) -> dict:
    """
    Build GLEE config JSON.

    The human's URL is set to backend_url/session/{session_id} so GLEE's
    HTTPPlayer appends /chat and hits our bridge endpoint.
    """
    human_url = f"{backend_url}/session/{session_id}"

    if player_role == "alice":
        p1_url = human_url
        p2_url = ai_server_url
    else:
        p1_url = ai_server_url
        p2_url = human_url

    config = {
        "player_1_type": "http",
        "player_1_args": {
            "url": p1_url,
            "public_name": "Alice",
        },
        "player_2_type": "http",
        "player_2_args": {
            "url": p2_url,
            "public_name": "Bob",
            "player_id": 3,
        },
        "game_type": game_family,
        "experiment_name": f"{HUMAN_GAME_EXPERIMENT_PREFIX}_{session_id}",
        "game_args": {
            **game_args,
            "delta_1": delta_1,
            "delta_2": delta_2,
            "timeout": DEFAULT_GLEE_HTTP_TIMEOUT,
        },
    }
    return config


def launch_glee_subprocess(config: dict) -> subprocess.Popen:
    """
    Launch GLEE as a subprocess. Returns the Popen object.

    The caller is responsible for monitoring/waiting on the process.
    """
    config_path = GLEE_DIR / f"tmp_human_ui_{config['experiment_name']}.json"
    config_path.write_text(json.dumps(config, indent=2))

    proc = subprocess.Popen(
        [
            sys.executable,
            "main.py",
            "-c", str(config_path.absolute()),
            "-n", "1",
        ],
        cwd=str(GLEE_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return proc
