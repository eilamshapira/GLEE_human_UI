"""
GLEE Human UI — FastAPI backend.

Endpoints:
  POST /api/games              Create & launch a game
  GET  /api/games              List games
  GET  /api/games/{id}         Game state
  POST /api/games/{id}/respond Human submits action (REST fallback)
  POST /api/games/{id}/ai-suggest  AI split/message suggestion
  POST /session/{id}/chat      GLEE HTTPPlayer posts here (blocks until human responds)
  WS   /ws/{id}                Real-time updates to frontend
"""

from __future__ import annotations

import asyncio
import json

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config import BACKEND_HOST, BACKEND_PORT
from models import (
    CreateGameRequest,
    HumanResponseRequest,
    AISuggestRequest,
    GLEEChatRequest,
)
from glee_bridge import bridge
from ws_manager import ws_manager
from game_manager import game_manager
from ai_assistant import suggest
from interaction_logger import interaction_logger

app = FastAPI(title="GLEE Human UI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Game CRUD
# ---------------------------------------------------------------------------

@app.post("/api/games")
async def create_game(req: CreateGameRequest):
    """Create and launch a new game."""
    session = game_manager.create_game(req)

    # Launch GLEE subprocess
    game_manager.launch(session)

    # Monitor in background
    asyncio.create_task(game_manager.monitor(session))

    return {
        "session_id": session.session_id,
        "game_family": session.game_family,
        "player_role": session.player_role,
        "status": session.status,
        "assist_mode": session.assist_mode,
    }


@app.get("/api/games")
async def list_games():
    return game_manager.list_all()


@app.get("/api/games/{session_id}")
async def get_game(session_id: str):
    session = game_manager.get(session_id)
    if session is None:
        raise HTTPException(404, "Game not found")
    return {
        "session_id": session.session_id,
        "game_family": session.game_family,
        "player_role": session.player_role,
        "status": session.status,
        "game_args": session.game_args,
        "delta_1": session.delta_1,
        "delta_2": session.delta_2,
    }


# ---------------------------------------------------------------------------
# GLEE Bridge — GLEE's HTTPPlayer POSTs here and blocks
# ---------------------------------------------------------------------------

@app.post("/session/{session_id}/chat")
async def glee_chat(session_id: str, req: GLEEChatRequest):
    """
    GLEE's HTTPPlayer hits this endpoint. We block until the human responds.

    Flow:
    1. Store the turn in the bridge
    2. Push game state to frontend via WebSocket
    3. Wait for human response (asyncio.Event)
    4. Return the response to GLEE
    """
    session = game_manager.get(session_id)
    if session is None:
        raise HTTPException(404, "Unknown session")

    # Determine turn type: GLEE doesn't always set decision=True,
    # so we also detect from prompt content
    is_decision = req.decision
    if not is_decision and req.messages:
        for msg in reversed(req.messages):
            if msg.role in ("user", "system"):
                content_lower = msg.content.lower()
                if ("accept" in content_lower and "reject" in content_lower) or \
                   "do you accept" in content_lower or \
                   '{"decision"' in content_lower:
                    is_decision = True
                break

    turn_type = "decision" if is_decision else "proposal"

    # Extract last offer if this is a decision turn
    last_offer = None
    if is_decision and req.messages:
        import re as _re
        # Search the last user/system message for the offer being presented
        for msg in reversed(req.messages):
            if msg.role not in ("user", "system"):
                continue
            content = msg.content

            # Method 1: Parse GLEE's text format "# Alice gain: 3500\n# Bob gain: 6500"
            alice_match = _re.search(r"#\s*Alice\s+gain:\s*([\d,]+)", content, _re.IGNORECASE)
            bob_match = _re.search(r"#\s*Bob\s+gain:\s*([\d,]+)", content, _re.IGNORECASE)
            if alice_match and bob_match:
                last_offer = {
                    "alice_gain": int(alice_match.group(1).replace(",", "")),
                    "bob_gain": int(bob_match.group(1).replace(",", "")),
                }
                # Also extract message if present
                msg_match = _re.search(r"#\s*\w+'s message:\s*(.+)", content)
                if msg_match:
                    last_offer["message"] = msg_match.group(1).strip()
                break

            # Method 2: Parse JSON format {"alice_gain": ..., "bob_gain": ...}
            if "{" in content:
                matches = _re.findall(r"\{.*?\}", content, _re.DOTALL)
                for match_str in reversed(matches):
                    try:
                        cleaned = _re.sub(r"(?<=\d),(?=\d{3})", "", match_str)
                        data = json.loads(cleaned)
                        if "alice_gain" in data or "bob_gain" in data:
                            last_offer = data
                            break
                    except json.JSONDecodeError:
                        pass
                if last_offer:
                    break

    # Register the pending turn (also increments chat count for round tracking)
    bridge.register_turn(
        session_id=session_id,
        messages=[{"role": m.role, "content": m.content} for m in req.messages],
        decision=is_decision,
        game_params=req.game_params,
    )

    # Derive round number from chat request count (GLEE doesn't send round_number)
    round_number = bridge.get_round_number(session_id)

    # Push game state to connected frontend
    await ws_manager.send_json(session_id, {
        "type": "game_state",
        "session_id": session_id,
        "turn_type": turn_type,
        "round_number": round_number,
        "messages": [{"role": m.role, "content": m.content} for m in req.messages],
        "game_params": req.game_params,
        "player_role": session.player_role,
        "last_offer": last_offer,
    })

    # Block until human responds (or timeout)
    response = await bridge.wait_for_response(session_id, timeout=600)

    if response is None:
        # Timeout — return empty (GLEE will handle the error)
        return {"response": ""}

    return {"response": response}


# ---------------------------------------------------------------------------
# Human response (REST fallback — primary path is WebSocket)
# ---------------------------------------------------------------------------

@app.post("/api/games/{session_id}/respond")
async def respond(session_id: str, req: HumanResponseRequest):
    """REST endpoint for submitting human response."""
    session = game_manager.get(session_id)
    if session is None:
        raise HTTPException(404, "Game not found")

    pending = bridge.get_pending(session_id)
    if pending is None:
        raise HTTPException(400, "No pending turn")

    response_json = _build_response_json(req, session, pending)
    ok = bridge.submit_response(session_id, response_json)
    if not ok:
        raise HTTPException(400, "No pending turn to respond to")

    return {"status": "submitted"}


# ---------------------------------------------------------------------------
# AI Suggestions
# ---------------------------------------------------------------------------

@app.post("/api/games/{session_id}/ai-suggest")
async def ai_suggest(session_id: str, req: AISuggestRequest):
    """Get AI suggestion for split or message."""
    session = game_manager.get(session_id)
    if session is None:
        raise HTTPException(404, "Game not found")

    if session.assist_mode != "ai_assisted":
        raise HTTPException(403, "AI suggestions disabled in this mode")

    pending = bridge.get_pending(session_id)
    messages = pending.messages if pending else []
    game_params = pending.game_params if pending else session.game_args

    result = await suggest(req, game_params, messages, session.player_role)
    return result


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(ws: WebSocket, session_id: str):
    await ws_manager.connect(session_id, ws)
    try:
        while True:
            data = await ws.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "submit_response":
                # Human submitted their action via WebSocket
                session = game_manager.get(session_id)
                pending = bridge.get_pending(session_id)
                if session and pending:
                    response_json = _build_response_json_from_ws(
                        msg, session, pending
                    )
                    ok = bridge.submit_response(session_id, response_json)
                    if ok:
                        # Transition frontend to "waiting" state
                        await ws.send_text(json.dumps({
                            "type": "game_state",
                            "session_id": session_id,
                            "turn_type": "waiting",
                            "round_number": bridge.get_round_number(session_id),
                            "messages": pending.messages,
                            "game_params": pending.game_params,
                            "player_role": session.player_role,
                            "last_offer": None,
                        }))

            elif msg.get("type") == "track_event":
                try:
                    interaction_logger.log(session_id, msg.get("payload", msg))
                except Exception:
                    pass  # never break the game for tracking

    except WebSocketDisconnect:
        ws_manager.disconnect(session_id, ws)
    except Exception as e:
        print(f"[WS Error] {session_id}: {e}")
        import traceback
        traceback.print_exc()
        ws_manager.disconnect(session_id, ws)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_response_json(
    req: HumanResponseRequest, session, pending
) -> str:
    """Build the JSON string that GLEE expects from the human player."""
    if pending.decision:
        return json.dumps({"decision": req.decision})

    data: dict = {}
    if req.alice_gain is not None:
        data["alice_gain"] = req.alice_gain
    if req.bob_gain is not None:
        data["bob_gain"] = req.bob_gain
    if session.game_args.get("messages_allowed"):
        data["message"] = req.message or ""

    return json.dumps(data)


def _build_response_json_from_ws(
    msg: dict, session, pending
) -> str:
    """Build GLEE response JSON from a WebSocket message."""
    payload = msg.get("payload", {})

    if pending.decision:
        return json.dumps({"decision": payload.get("decision", "reject")})

    data: dict = {}
    if "alice_gain" in payload:
        data["alice_gain"] = payload["alice_gain"]
    if "bob_gain" in payload:
        data["bob_gain"] = payload["bob_gain"]
    if session.game_args.get("messages_allowed"):
        data["message"] = payload.get("message", "")

    return json.dumps(data)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=BACKEND_HOST, port=BACKEND_PORT)
