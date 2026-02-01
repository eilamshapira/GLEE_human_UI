"""WebSocket connection manager."""

from __future__ import annotations

import json
from typing import Any

from fastapi import WebSocket


class WSManager:
    """Manages WebSocket connections per game session."""

    def __init__(self):
        # session_id -> list of connected WebSockets
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, session_id: str, ws: WebSocket):
        await ws.accept()
        self._connections.setdefault(session_id, []).append(ws)

    def disconnect(self, session_id: str, ws: WebSocket):
        conns = self._connections.get(session_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self._connections.pop(session_id, None)

    async def send_json(self, session_id: str, data: dict[str, Any]):
        """Send JSON to all connected clients for a session."""
        conns = self._connections.get(session_id, [])
        dead = []
        for ws in conns:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(session_id, ws)

    def has_connections(self, session_id: str) -> bool:
        return bool(self._connections.get(session_id))


ws_manager = WSManager()
