"""
GLEE Bridge — the critical async bridge between GLEE and the human UI.

Flow per turn:
1. GLEE HTTPPlayer POSTs to /session/{session_id}/chat with {messages, decision, game_params}
2. This bridge stores the request, creates an asyncio.Event, pushes state via WebSocket
3. Human sees game state in React, fills form, clicks "Send offer"
4. React -> WebSocket -> bridge.submit_human_response() -> Event.set()
5. The blocked /chat handler returns {"response": "<json>"} to GLEE
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class PendingTurn:
    """A turn waiting for the human to respond."""
    messages: list[dict[str, Any]]
    decision: bool
    game_params: dict[str, Any]
    event: asyncio.Event = field(default_factory=asyncio.Event)
    response: Optional[str] = None


class GLEEBridge:
    """Manages pending turns for human players across sessions."""

    def __init__(self):
        # session_id -> PendingTurn (only one pending turn per session at a time)
        self._pending: dict[str, PendingTurn] = {}
        # session_id -> number of /chat requests (1 request per round per player)
        self._chat_count: dict[str, int] = {}

    def register_turn(
        self,
        session_id: str,
        messages: list[dict[str, Any]],
        decision: bool,
        game_params: dict[str, Any],
    ) -> PendingTurn:
        """
        Register a new pending turn from GLEE.

        Called when GLEE POSTs to /session/{session_id}/chat.
        Returns a PendingTurn whose .event can be awaited.
        """
        # Track chat requests to derive round number (1 request per round per player)
        self._chat_count[session_id] = self._chat_count.get(session_id, 0) + 1

        turn = PendingTurn(
            messages=messages,
            decision=decision,
            game_params=game_params,
        )
        self._pending[session_id] = turn
        return turn

    def submit_response(self, session_id: str, response_json: str) -> bool:
        """
        Submit the human's response, unblocking the GLEE /chat handler.

        Returns True if there was a pending turn, False otherwise.
        """
        turn = self._pending.get(session_id)
        if turn is None:
            return False
        turn.response = response_json
        turn.event.set()
        return True

    def get_pending(self, session_id: str) -> Optional[PendingTurn]:
        """Get current pending turn for a session (if any)."""
        return self._pending.get(session_id)

    def get_round_number(self, session_id: str) -> int:
        """Derive the current round number from the chat request count.

        GLEE sends exactly 1 /chat request per player per round, so
        chat_count == round_number for each player.
        """
        return self._chat_count.get(session_id, 0)

    def clear(self, session_id: str):
        """Remove pending turn for a session."""
        self._pending.pop(session_id, None)
        self._chat_count.pop(session_id, None)

    async def wait_for_response(self, session_id: str, timeout: float = 600) -> Optional[str]:
        """
        Wait for the human to respond to the current pending turn.

        Returns the response JSON string, or None on timeout.
        """
        turn = self._pending.get(session_id)
        if turn is None:
            return None
        try:
            await asyncio.wait_for(turn.event.wait(), timeout=timeout)
            return turn.response
        except asyncio.TimeoutError:
            return None
        finally:
            self._pending.pop(session_id, None)


# Singleton
bridge = GLEEBridge()
