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

from config import GLEE_DIR, GLEE_PYTHON, DEFAULT_GAME_TIMEOUT, DEFAULT_GLEE_HTTP_TIMEOUT, HUMAN_GAME_EXPERIMENT_PREFIX


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
    We log stdout/stderr to files to avoid pipe buffer deadlocks.
    """
    config_path = GLEE_DIR / f"tmp_human_ui_{config['experiment_name']}.json"
    config_path.write_text(json.dumps(config, indent=2))

    log_dir = GLEE_DIR / "Data" / config["experiment_name"]
    log_dir.mkdir(parents=True, exist_ok=True)
    stdout_log = open(log_dir / "stdout.log", "w")
    stderr_log = open(log_dir / "stderr.log", "w")

    try:
        proc = subprocess.Popen(
            [
                GLEE_PYTHON, "-u",
                "main.py",
                "-c", str(config_path.absolute()),
                "-n", "1",
            ],
            cwd=str(GLEE_DIR),
            stdout=stdout_log,
            stderr=stderr_log,
        )
    except Exception:
        stdout_log.close()
        stderr_log.close()
        raise
    # Attach file handles so they can be closed later
    proc._stdout_log = stdout_log  # type: ignore
    proc._stderr_log = stderr_log  # type: ignore
    return proc
