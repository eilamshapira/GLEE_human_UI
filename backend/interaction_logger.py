"""
Interaction Logger — writes user interaction events to JSONL files.

Each game session gets its own interaction_log.jsonl inside the game's
output directory (GLEE/Data/human_ui_{session_id}/).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, IO

from config import GLEE_DIR, HUMAN_GAME_EXPERIMENT_PREFIX


class InteractionLogger:
    """Append-only JSONL logger for user interaction events."""

    def __init__(self):
        self._handles: dict[str, IO[str]] = {}

    def _get_handle(self, session_id: str) -> IO[str]:
        if session_id not in self._handles:
            log_dir = GLEE_DIR / "Data" / f"{HUMAN_GAME_EXPERIMENT_PREFIX}_{session_id}"
            log_dir.mkdir(parents=True, exist_ok=True)
            path = log_dir / "interaction_log.jsonl"
            self._handles[session_id] = open(path, "a", buffering=1)  # line-buffered
        return self._handles[session_id]

    def log(self, session_id: str, event_dict: dict[str, Any]) -> None:
        """Append one event line to the session's JSONL file."""
        record = {
            "session_id": session_id,
            **event_dict,
            "server_ts": datetime.now(timezone.utc).isoformat(),
        }
        fh = self._get_handle(session_id)
        fh.write(json.dumps(record, default=str) + "\n")
        fh.flush()

    def close(self, session_id: str) -> None:
        """Close the file handle for a finished session."""
        fh = self._handles.pop(session_id, None)
        if fh is not None:
            try:
                fh.close()
            except Exception:
                pass


interaction_logger = InteractionLogger()
