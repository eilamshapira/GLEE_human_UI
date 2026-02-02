#!/usr/bin/env python3
"""
Human-vs-Human server for GLEE Human UI.

Replaces the mock AI with a second human player served via a browser UI.
GLEE's HTTPPlayer POSTs to /chat; this server blocks until the second
human responds through a WebSocket-connected web page on port 5001.

Usage:
    python scripts/mock_ai_server.py              # human bridge (default)
    python scripts/mock_ai_server.py --auto        # original mock AI mode
"""

from __future__ import annotations

import asyncio
import json
import re
import random
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

app = FastAPI(title="Player 2 Server")

# ---------------------------------------------------------------------------
# Mode flag — set via CLI
# ---------------------------------------------------------------------------
AUTO_MODE = False

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    decision: bool = False
    game_params: Dict[str, Any] = {}


# ---------------------------------------------------------------------------
# Bridge (blocks /chat until human responds)
# ---------------------------------------------------------------------------

class _PendingTurn:
    def __init__(self, turn_type: str, messages: list, game_params: dict,
                 last_offer: Optional[dict], player_name: str, money: int,
                 round_number: int):
        self.turn_type = turn_type
        self.messages = messages
        self.game_params = game_params
        self.last_offer = last_offer
        self.player_name = player_name
        self.money = money
        self.round_number = round_number
        self.event = asyncio.Event()
        self.response: Optional[str] = None


_pending: Optional[_PendingTurn] = None
_chat_count = 0
_ws_clients: list[WebSocket] = []


def _reset_game_state():
    """Reset per-game state for a fresh game."""
    global _pending, _chat_count
    _pending = None
    _chat_count = 0


async def _broadcast(data: dict):
    dead = []
    for ws in _ws_clients:
        try:
            await ws.send_text(json.dumps(data))
        except Exception:
            dead.append(ws)
    for ws in dead:
        _ws_clients.remove(ws)


# ---------------------------------------------------------------------------
# Turn-type detection (same logic as main backend)
# ---------------------------------------------------------------------------

def _is_decision_turn(req: ChatRequest) -> bool:
    if req.decision:
        return True
    for msg in reversed(req.messages):
        if msg.role in ("user", "system"):
            content = msg.content.lower()
            if "accept" in content and "reject" in content:
                return True
            if "do you accept" in content:
                return True
            if '{"decision"' in content:
                return True
            break
    return False


def _extract_last_offer(messages: list[Message]) -> Optional[dict]:
    """Extract the last offer from messages (for decision turns).

    Only examines user/system messages to avoid picking up stale data
    from our own (assistant) responses.
    """
    for msg in reversed(messages):
        if msg.role not in ("user", "system"):
            continue
        content = msg.content
        # Method 1: GLEE text format
        alice_m = re.search(r"#\s*Alice\s+gain:\s*([\d,]+)", content, re.IGNORECASE)
        bob_m = re.search(r"#\s*Bob\s+gain:\s*([\d,]+)", content, re.IGNORECASE)
        if alice_m and bob_m:
            offer = {
                "alice_gain": int(alice_m.group(1).replace(",", "")),
                "bob_gain": int(bob_m.group(1).replace(",", "")),
            }
            msg_m = re.search(r"#\s*\w+'s message:\s*(.+)", content)
            if msg_m:
                offer["message"] = msg_m.group(1).strip()
            return offer
        # Method 2: JSON format
        if "{" in content:
            for match_str in reversed(re.findall(r"\{.*?\}", content, re.DOTALL)):
                try:
                    cleaned = re.sub(r"(?<=\d),(?=\d{3})", "", match_str)
                    data = json.loads(cleaned)
                    if "alice_gain" in data or "bob_gain" in data:
                        return data
                except json.JSONDecodeError:
                    pass
    return None


# ---------------------------------------------------------------------------
# Auto-mode logic (original mock AI)
# ---------------------------------------------------------------------------

def _auto_respond(req: ChatRequest, is_decision: bool) -> str:
    game_params = req.game_params
    money = game_params.get("money_to_divide", 10000)
    player_name = game_params.get("public_name", "Bob")

    if is_decision:
        last_offer = _extract_last_offer(req.messages)
        if last_offer:
            my_key = f"{player_name.lower()}_gain"
            my_gain = float(last_offer.get(my_key, 0))
            if money > 0 and my_gain / money >= 0.35:
                return json.dumps({"decision": "accept"})
        if random.random() < 0.3:
            return json.dumps({"decision": "accept"})
        return json.dumps({"decision": "reject"})
    else:
        my_pct = random.randint(55, 65)
        my_gain = round(money * my_pct / 100)
        rival_gain = money - my_gain
        player_lower = player_name.lower().replace(" ", "_")
        rival_lower = "alice" if player_lower != "alice" else "bob"
        response: dict[str, Any] = {
            f"{player_lower}_gain": my_gain,
            f"{rival_lower}_gain": rival_gain,
        }
        if game_params.get("messages_allowed", True):
            response["message"] = random.choice([
                "I think this is a fair split given the circumstances.",
                "Let's be reasonable here - this works for both of us.",
                "I believe this allocation reflects our positions well.",
                "How about this? I think we can both benefit.",
                "This is my best offer. Let's close the deal.",
            ])
        return json.dumps(response)


# ---------------------------------------------------------------------------
# /chat — GLEE posts here
# ---------------------------------------------------------------------------

@app.post("/chat")
async def chat(req: ChatRequest):
    global _pending, _chat_count

    is_decision = _is_decision_turn(req)

    if AUTO_MODE:
        return {"response": _auto_respond(req, is_decision)}

    # Human bridge mode
    game_params = req.game_params
    money = game_params.get("money_to_divide", 10000)
    player_name = game_params.get("public_name", "Bob")

    # Auto-detect new game: first turn of a new game has very few messages
    # (typically 1-2 system/user messages). If _chat_count is already high,
    # a previous game's state leaked — reset it.
    num_non_system = sum(1 for m in req.messages if m.role != "system")
    if _chat_count > 0 and num_non_system <= 1:
        _reset_game_state()

    _chat_count += 1
    round_number = _chat_count

    last_offer = _extract_last_offer(req.messages) if is_decision else None

    turn = _PendingTurn(
        turn_type="decision" if is_decision else "proposal",
        messages=[{"role": m.role, "content": m.content} for m in req.messages],
        game_params=game_params,
        last_offer=last_offer,
        player_name=player_name,
        money=money,
        round_number=round_number,
    )
    _pending = turn

    # Push to browser
    await _broadcast({
        "type": "game_state",
        "turn_type": turn.turn_type,
        "round_number": round_number,
        "messages": turn.messages,
        "game_params": game_params,
        "player_name": player_name,
        "last_offer": last_offer,
        "money": money,
        "messages_allowed": game_params.get("messages_allowed", True),
    })

    # Block until human responds (10 min timeout)
    try:
        await asyncio.wait_for(turn.event.wait(), timeout=600)
    except asyncio.TimeoutError:
        _pending = None
        return {"response": ""}

    response = turn.response
    _pending = None
    return {"response": response}


# ---------------------------------------------------------------------------
# WebSocket for player 2 browser
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    _ws_clients.append(ws)
    try:
        while True:
            data = await ws.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "submit_response":
                global _pending
                if _pending is not None:
                    payload = msg.get("payload", {})

                    if _pending.turn_type == "decision":
                        response_json = json.dumps({
                            "decision": payload.get("decision", "reject")
                        })
                    else:
                        allowed_keys = ["alice_gain", "bob_gain"]
                        if _pending.game_params.get("messages_allowed", True):
                            allowed_keys.append("message")
                        response_json = json.dumps({
                            k: v for k, v in payload.items()
                            if k in allowed_keys
                        })

                    _pending.response = response_json
                    _pending.event.set()

                    # Tell browser we're waiting now
                    await _broadcast({"type": "waiting"})

    except WebSocketDisconnect:
        if ws in _ws_clients:
            _ws_clients.remove(ws)


# ---------------------------------------------------------------------------
# Player 2 web UI
# ---------------------------------------------------------------------------

PLAYER2_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Player 2 — GLEE</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f7fa; color: #1e293b; min-height: 100vh;
    display: flex; flex-direction: column;
  }

  /* ── Top bar ── */
  .top-bar {
    background: #ffffff; border-bottom: 1px solid #e2e8f0;
    padding: 14px 24px; display: flex; align-items: center; gap: 12px;
  }
  .top-bar h1 { font-size: 18px; font-weight: 700; color: #0f172a; }
  .badge {
    font-size: 11px; padding: 4px 12px; border-radius: 999px;
    font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;
  }
  .badge-waiting { background: #fef3c7; color: #92400e; }
  .badge-myturn  { background: #dbeafe; color: #1e40af; }
  .badge-connected    { background: #d1fae5; color: #065f46; }
  .badge-disconnected { background: #fee2e2; color: #991b1b; }
  .round-info { margin-left: auto; color: #64748b; font-size: 14px; font-weight: 500; }

  /* ── Layout ── */
  .main { display: flex; flex: 1; overflow: hidden; }
  .chat-panel {
    width: 50%; border-right: 1px solid #e2e8f0;
    display: flex; flex-direction: column; overflow-y: auto;
    padding: 20px; gap: 10px; background: #ffffff;
  }
  .controls-panel {
    width: 50%; padding: 28px; overflow-y: auto;
    display: flex; flex-direction: column; gap: 24px;
  }

  /* ── Chat messages ── */
  .msg {
    padding: 10px 14px; border-radius: 12px; max-width: 85%;
    font-size: 14px; line-height: 1.55;
  }
  .msg-system {
    background: #f1f5f9; color: #64748b; align-self: center;
    max-width: 95%; font-size: 12px; border-radius: 8px;
  }
  .msg-assistant {
    background: #f0f4ff; color: #1e3a5f; align-self: flex-start;
    border: 1px solid #e0e7ff;
  }
  .msg-user {
    background: #ecfdf5; color: #064e3b; align-self: flex-end;
    border: 1px solid #d1fae5;
  }

  /* ── Waiting state ── */
  .waiting-box {
    flex: 1; display: flex; align-items: center; justify-content: center;
    flex-direction: column; color: #94a3b8;
  }
  .waiting-box .dots { font-size: 36px; animation: pulse 1.5s infinite; }
  .waiting-box p { font-size: 15px; margin-top: 4px; }
  @keyframes pulse { 0%,100% { opacity: .3; } 50% { opacity: 1; } }

  /* ── Cards ── */
  .card {
    background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;
    padding: 24px;
  }
  .card-header {
    font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 20px;
  }

  /* ── Slider ── */
  .slider-labels {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 12px;
  }
  .slider-label-name { font-size: 15px; font-weight: 600; color: #334155; }
  .slider-label-pct  { font-size: 15px; font-weight: 700; color: #0f172a; }
  .slider-dot { color: #94a3b8; font-size: 18px; font-weight: 700; }

  .slider-track {
    position: relative; width: 100%; height: 10px;
    background: #e2e8f0; border-radius: 5px; overflow: visible;
  }
  .slider-fill {
    height: 100%; background: #1e293b; border-radius: 5px;
    transition: width 0.05s;
  }

  input[type=range] {
    -webkit-appearance: none; appearance: none;
    width: 100%; height: 10px; background: transparent;
    position: absolute; top: 0; left: 0; margin: 0; cursor: pointer;
  }
  input[type=range]::-webkit-slider-runnable-track {
    height: 10px; background: transparent; border-radius: 5px;
  }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 24px; height: 24px; border-radius: 50%;
    background: #ffffff; border: 2px solid #cbd5e1;
    box-shadow: 0 1px 4px rgba(0,0,0,0.15);
    margin-top: -7px; cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  input[type=range]::-webkit-slider-thumb:hover {
    border-color: #94a3b8;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  input[type=range]::-moz-range-thumb {
    width: 24px; height: 24px; border-radius: 50%;
    background: #ffffff; border: 2px solid #cbd5e1;
    box-shadow: 0 1px 4px rgba(0,0,0,0.15); cursor: pointer;
  }
  input[type=range]::-moz-range-track {
    height: 10px; background: transparent; border: none;
  }

  /* ── Textarea ── */
  textarea {
    width: 100%; min-height: 80px; background: #ffffff;
    border: 1px solid #e2e8f0; border-radius: 12px;
    padding: 14px 16px; color: #1e293b; font-size: 14px;
    font-family: inherit; resize: vertical; line-height: 1.5;
  }
  textarea::placeholder { color: #94a3b8; }
  textarea:focus { outline: none; border-color: #94a3b8; box-shadow: 0 0 0 3px rgba(148,163,184,0.15); }

  /* ── Buttons ── */
  .btn {
    padding: 12px 24px; border: none; border-radius: 999px; font-size: 14px;
    font-weight: 600; cursor: pointer; transition: all 0.15s;
    display: inline-flex; align-items: center; gap: 8px; justify-content: center;
  }
  .btn-send {
    background: #1e293b; color: #ffffff;
  }
  .btn-send:hover { background: #334155; }
  .btn-send svg { width: 16px; height: 16px; }

  .btn-clear {
    background: transparent; color: #64748b; font-weight: 500;
  }
  .btn-clear:hover { color: #1e293b; }

  .btn-accept {
    background: #059669; color: #ffffff; flex: 1;
  }
  .btn-accept:hover { background: #047857; }

  .btn-reject {
    background: #ffffff; color: #dc2626; flex: 1;
    border: 1px solid #fecaca;
  }
  .btn-reject:hover { background: #fef2f2; border-color: #f87171; }

  .buttons-row {
    display: flex; align-items: center; justify-content: flex-end; gap: 12px;
    margin-top: 4px;
  }
  .decision-buttons { display: flex; gap: 12px; }

  /* ── Offer card (decision) ── */
  .offer-gains {
    display: flex; justify-content: space-between; font-size: 15px;
    font-weight: 600; color: #334155; margin-bottom: 12px;
  }
  .offer-bar {
    display: flex; height: 10px; border-radius: 5px; overflow: hidden;
    background: #e2e8f0;
  }
  .offer-bar-alice { background: #1e293b; }
  .offer-bar-bob   { background: #94a3b8; }
  .offer-msg {
    font-style: italic; color: #64748b; margin-top: 14px; font-size: 14px;
    padding: 12px 16px; background: #f8fafc; border-radius: 10px;
    border-left: 3px solid #cbd5e1;
  }
</style>
</head>
<body>

<div class="top-bar">
  <h1 id="headerTitle">Player 2</h1>
  <span id="connBadge" class="badge badge-disconnected">disconnected</span>
  <span id="turnBadge" class="badge badge-waiting">waiting</span>
  <span id="roundInfo" class="round-info"></span>
</div>

<div class="main">
  <div class="chat-panel" id="chatPanel"></div>
  <div class="controls-panel" id="controlsPanel">
    <div class="waiting-box" id="waitingBox">
      <div class="dots">...</div>
      <p>Waiting for the game to start</p>
    </div>
  </div>
</div>

<script>
const WS_URL = `ws://${location.host}/ws`;
let ws = null;
let state = { turnType: 'waiting', money: 10000, playerName: 'Bob', sliderPct: 50, messagesAllowed: true };

function connect() {
  ws = new WebSocket(WS_URL);
  ws.onopen = () => {
    document.getElementById('connBadge').textContent = 'connected';
    document.getElementById('connBadge').className = 'badge badge-connected';
  };
  ws.onclose = () => {
    document.getElementById('connBadge').textContent = 'disconnected';
    document.getElementById('connBadge').className = 'badge badge-disconnected';
    setTimeout(connect, 2000);
  };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'game_state') handleGameState(msg);
    else if (msg.type === 'waiting') showWaiting('Waiting for opponent...');
  };
}

function handleGameState(msg) {
  state.turnType = msg.turn_type;
  state.money = msg.money || 10000;
  state.playerName = msg.player_name || 'Bob';
  state.lastOffer = msg.last_offer;
  state.messagesAllowed = msg.messages_allowed !== false;

  document.getElementById('headerTitle').textContent = `Player 2 — ${state.playerName}`;
  document.getElementById('roundInfo').textContent = `Round ${msg.round_number}`;
  document.getElementById('turnBadge').textContent = msg.turn_type === 'proposal' ? 'your turn — propose' : 'your turn — decide';
  document.getElementById('turnBadge').className = 'badge badge-myturn';

  renderChat(msg.messages || []);

  if (msg.turn_type === 'proposal') renderProposalForm();
  else if (msg.turn_type === 'decision') renderDecisionForm();
}

function renderChat(messages) {
  const panel = document.getElementById('chatPanel');
  panel.innerHTML = '';
  for (const m of messages) {
    const div = document.createElement('div');
    div.className = 'msg msg-' + m.role;
    div.textContent = m.content;
    panel.appendChild(div);
  }
  panel.scrollTop = panel.scrollHeight;
}

function renderProposalForm() {
  const rivalName = state.playerName === 'Alice' ? 'Bob' : 'Alice';
  state.sliderPct = state.playerName === 'Alice' ? 60 : 40;
  const g = calcGains();
  const alicePct = Math.round((g.alice / state.money) * 100);
  const bobPct = 100 - alicePct;
  const cp = document.getElementById('controlsPanel');
  cp.innerHTML = `
    <div class="card">
      <div class="card-header">Split</div>
      <div class="slider-labels">
        <div><span class="slider-label-name">Alice</span>&nbsp;&nbsp;<span class="slider-label-pct" id="alicePct">${alicePct}%</span></div>
        <span class="slider-dot">&middot;</span>
        <div><span class="slider-label-name">Bob</span>&nbsp;&nbsp;<span class="slider-label-pct" id="bobPct">${bobPct}%</span></div>
      </div>
      <div style="position:relative;">
        <div class="slider-track">
          <div class="slider-fill" id="sliderFill" style="width:${state.sliderPct}%"></div>
        </div>
        <input type="range" min="0" max="100" value="${state.sliderPct}" id="slider" oninput="onSlider(this.value)">
      </div>
    </div>
    ${state.messagesAllowed ? `
    <div class="card">
      <div class="card-header">Message to ${rivalName}</div>
      <textarea id="msgInput" placeholder="Type your message to ${rivalName}..."></textarea>
    </div>` : ''}
    <div class="buttons-row">
      <button class="btn btn-send" onclick="sendProposal()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        Send offer
      </button>
    </div>
  `;
}

function calcGains() {
  const alice = Math.round((state.sliderPct / 100) * state.money);
  return { alice, bob: state.money - alice };
}

function onSlider(val) {
  state.sliderPct = parseInt(val);
  const g = calcGains();
  const alicePct = Math.round((g.alice / state.money) * 100);
  const bobPct = 100 - alicePct;
  document.getElementById('alicePct').textContent = alicePct + '%';
  document.getElementById('bobPct').textContent = bobPct + '%';
  document.getElementById('sliderFill').style.width = state.sliderPct + '%';
}

function sendProposal() {
  const g = calcGains();
  const msg = document.getElementById('msgInput')?.value || '';
  const payload = { alice_gain: g.alice, bob_gain: g.bob };
  if (msg.trim()) payload.message = msg.trim();
  ws.send(JSON.stringify({ type: 'submit_response', payload }));
  showWaiting('Waiting for opponent...');
}

function renderDecisionForm() {
  const rivalName = state.playerName === 'Alice' ? 'Bob' : 'Alice';
  const offer = state.lastOffer || {};
  const aliceG = offer.alice_gain ?? 0;
  const bobG = offer.bob_gain ?? 0;
  const offerMsg = offer.message || '';
  const alicePct = state.money > 0 ? Math.round((aliceG / state.money) * 100) : 50;
  const bobPct = 100 - alicePct;
  const cp = document.getElementById('controlsPanel');
  cp.innerHTML = `
    <div class="card">
      <div class="card-header">${rivalName}'s Offer</div>
      <div class="offer-gains">
        <span>Alice &nbsp;${alicePct}%</span>
        <span>Bob &nbsp;${bobPct}%</span>
      </div>
      <div class="offer-bar">
        <div class="offer-bar-alice" style="width:${alicePct}%"></div>
        <div class="offer-bar-bob" style="width:${bobPct}%"></div>
      </div>
      ${offerMsg ? `<div class="offer-msg">"${offerMsg}"</div>` : ''}
    </div>
    <div class="decision-buttons">
      <button class="btn btn-accept" onclick="sendDecision('accept')">Accept</button>
      <button class="btn btn-reject" onclick="sendDecision('reject')">Reject</button>
    </div>
  `;
}

function sendDecision(d) {
  ws.send(JSON.stringify({ type: 'submit_response', payload: { decision: d } }));
  showWaiting('Waiting for opponent...');
}

function showWaiting(text) {
  document.getElementById('turnBadge').textContent = 'waiting';
  document.getElementById('turnBadge').className = 'badge badge-waiting';
  document.getElementById('controlsPanel').innerHTML = `
    <div class="waiting-box"><div class="dots">...</div><p>${text}</p></div>
  `;
}

connect();
</script>
</body>
</html>"""


@app.get("/", response_class=HTMLResponse)
async def player2_ui():
    return PLAYER2_HTML


@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": True, "device": "human" if not AUTO_MODE else "mock"}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser()
    parser.add_argument("--auto", action="store_true", help="Use automatic mock AI instead of human bridge")
    parser.add_argument("--port", type=int, default=5001)
    args = parser.parse_args()

    AUTO_MODE = args.auto
    mode = "AUTO (mock AI)" if AUTO_MODE else "HUMAN BRIDGE"
    print(f"Starting Player 2 server in {mode} mode on port {args.port}")
    print(f"  Open http://localhost:{args.port} in your browser to play as Player 2")

    uvicorn.run(app, host="0.0.0.0", port=args.port)
