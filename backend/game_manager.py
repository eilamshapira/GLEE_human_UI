"""
Game Manager — session lifecycle management.

Tracks active games, launches GLEE subprocesses, monitors completion.
"""

from __future__ import annotations

import asyncio
import json
import re
import subprocess
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

from config import BACKEND_PORT, GLEE_DIR, HUMAN_GAME_EXPERIMENT_PREFIX
from game_launcher import build_glee_config, launch_glee_subprocess
from glee_bridge import bridge
from ws_manager import ws_manager
from models import CreateGameRequest
from interaction_logger import interaction_logger


@dataclass
class GameSession:
    session_id: str
    game_family: str
    player_role: str
    ai_server_url: str
    game_args: dict[str, Any]
    delta_1: float
    delta_2: float
    assist_mode: str = "ai_assisted"
    status: str = "active"  # active, finished, error
    created_at: str = ""
    process: Optional[subprocess.Popen] = field(default=None, repr=False)
    result: Optional[dict[str, Any]] = None


class GameManager:
    """Manages all active game sessions."""

    def __init__(self):
        self._sessions: dict[str, GameSession] = {}

    def create_game(self, req: CreateGameRequest) -> GameSession:
        session_id = uuid.uuid4().hex[:12]

        game_args = {
            "money_to_divide": req.money_to_divide,
            "max_rounds": req.max_rounds,
            "complete_information": req.complete_information,
            "messages_allowed": req.messages_allowed,
        }

        session = GameSession(
            session_id=session_id,
            game_family=req.game_family.value,
            player_role=req.player_role.value,
            ai_server_url=req.ai_server_url,
            game_args=game_args,
            delta_1=req.delta_1,
            delta_2=req.delta_2,
            assist_mode=req.assist_mode.value,
            created_at=datetime.utcnow().isoformat(),
        )
        self._sessions[session_id] = session
        return session

    def launch(self, session: GameSession) -> None:
        """Launch the GLEE subprocess for a game session."""
        backend_url = f"http://127.0.0.1:{BACKEND_PORT}"

        config = build_glee_config(
            session_id=session.session_id,
            game_family=session.game_family,
            player_role=session.player_role,
            ai_server_url=session.ai_server_url,
            backend_url=backend_url,
            game_args=session.game_args,
            delta_1=session.delta_1,
            delta_2=session.delta_2,
        )

        proc = launch_glee_subprocess(config)
        session.process = proc

    async def monitor(self, session: GameSession) -> None:
        """Monitor a GLEE subprocess until it exits, then notify frontend."""
        proc = session.process
        if proc is None:
            return

        # Poll in background
        while proc.poll() is None:
            await asyncio.sleep(1)

        # Close log file handles
        if hasattr(proc, '_stdout_log'):
            proc._stdout_log.close()
        if hasattr(proc, '_stderr_log'):
            proc._stderr_log.close()

        # Read from log files
        from config import GLEE_DIR, HUMAN_GAME_EXPERIMENT_PREFIX
        log_dir = GLEE_DIR / "Data" / f"{HUMAN_GAME_EXPERIMENT_PREFIX}_{session.session_id}"
        stdout = ""
        stderr = ""
        try:
            stdout_path = log_dir / "stdout.log"
            stderr_path = log_dir / "stderr.log"
            if stdout_path.exists():
                stdout = stdout_path.read_text()
            if stderr_path.exists():
                stderr = stderr_path.read_text()
        except Exception:
            pass

        print(f"[GameManager] Game {session.session_id} exited with code {proc.returncode}")
        if stdout.strip():
            print(f"[GameManager] stdout: {stdout[:500]}")
        if stderr.strip():
            print(f"[GameManager] stderr: {stderr[:500]}")

        if proc.returncode == 0:
            session.status = "finished"
        else:
            session.status = "error"
            session.result = {"error": stderr[:500]}

        # Parse stdout to determine real outcome
        outcome, final_alice, final_bob = self._parse_outcome(stdout, proc.returncode)

        # Clean up pending bridge turn
        bridge.clear(session.session_id)

        # Close interaction log for this session
        interaction_logger.close(session.session_id)

        # Notify frontend
        await ws_manager.send_json(session.session_id, {
            "type": "game_finished",
            "session_id": session.session_id,
            "outcome": outcome,
            "final_alice": final_alice,
            "final_bob": final_bob,
            "stdout": stdout[:1000],
            "stderr": stderr[:500],
        })

    @staticmethod
    def _parse_outcome(stdout: str, returncode: int) -> tuple[str, int, int]:
        """Parse GLEE stdout to determine deal/no_deal and extract gains."""
        if returncode != 0:
            return "error", 0, 0

        # Check if someone accepted the offer
        accepted = "accepted the offer" in stdout.lower()

        if not accepted:
            return "no_deal", 0, 0

        # Extract gains from the last [RESPONSE] line containing alice_gain
        final_alice = 0
        final_bob = 0
        for line in reversed(stdout.splitlines()):
            if "alice_gain" in line:
                json_match = re.search(r'\{[^{}]*\}', line)
                if json_match:
                    try:
                        data = json.loads(json_match.group())
                        final_alice = int(data.get("alice_gain", 0))
                        final_bob = int(data.get("bob_gain", 0))
                        break
                    except (json.JSONDecodeError, ValueError):
                        pass

        return "deal", final_alice, final_bob

    def get(self, session_id: str) -> Optional[GameSession]:
        return self._sessions.get(session_id)

    def list_all(self) -> list[dict[str, Any]]:
        return [
            {
                "session_id": s.session_id,
                "game_family": s.game_family,
                "player_role": s.player_role,
                "status": s.status,
                "assist_mode": s.assist_mode,
                "created_at": s.created_at,
            }
            for s in self._sessions.values()
        ]


game_manager = GameManager()
