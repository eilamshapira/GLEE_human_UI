"""Pydantic models for the GLEE Human UI API."""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class GameFamily(str, Enum):
    bargaining = "bargaining"
    negotiation = "negotiation"
    persuasion = "persuasion"


class PlayerRole(str, Enum):
    alice = "alice"
    bob = "bob"


class TurnType(str, Enum):
    proposal = "proposal"
    decision = "decision"
    waiting = "waiting"
    finished = "finished"


class ToneModifier(str, Enum):
    more_credible = "more_credible"
    less_credible = "less_credible"
    more_logical = "more_logical"
    less_logical = "less_logical"
    more_aggressive = "more_aggressive"
    less_aggressive = "less_aggressive"
    more_emotional = "more_emotional"
    less_emotional = "less_emotional"


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------

class CreateGameRequest(BaseModel):
    game_family: GameFamily = GameFamily.bargaining
    player_role: PlayerRole = PlayerRole.alice
    ai_server_url: str = "http://localhost:5001"
    # Bargaining params
    money_to_divide: int = 10000
    max_rounds: int = 12
    delta_1: float = 0.95
    delta_2: float = 0.95
    complete_information: bool = True
    messages_allowed: bool = True


class HumanResponseRequest(BaseModel):
    """Human submits a proposal or decision."""
    # For proposals
    alice_gain: Optional[float] = None
    bob_gain: Optional[float] = None
    message: Optional[str] = None
    # For decisions
    decision: Optional[str] = None  # "accept" or "reject"


class AISuggestRequest(BaseModel):
    suggest_type: str  # "split" or "message"
    tone_modifiers: list[ToneModifier] = []
    current_message: str = ""


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------

class GameInfo(BaseModel):
    session_id: str
    game_family: str
    player_role: str
    status: str  # "active", "finished", "error"
    created_at: str


class GameStateMessage(BaseModel):
    """WebSocket message: current game state pushed to frontend."""
    type: str = "game_state"
    session_id: str
    turn_type: TurnType
    round_number: int = 1
    messages: list[dict[str, Any]] = []
    game_params: dict[str, Any] = {}
    player_role: str = "alice"
    last_offer: Optional[dict[str, Any]] = None


class GameFinishedMessage(BaseModel):
    """WebSocket message: game has ended."""
    type: str = "game_finished"
    session_id: str
    outcome: str = ""  # "accepted", "rejected_all", "timeout"
    final_round: int = 0
    payoffs: dict[str, float] = {}


class AISuggestResponse(BaseModel):
    suggested_split: Optional[dict[str, float]] = None
    suggested_message: Optional[str] = None


# ---------------------------------------------------------------------------
# GLEE chat protocol (what GLEE posts to us)
# ---------------------------------------------------------------------------

class GLEEMessage(BaseModel):
    role: str
    content: str


class GLEEChatRequest(BaseModel):
    messages: list[GLEEMessage]
    decision: bool = False
    game_params: dict[str, Any] = {}
