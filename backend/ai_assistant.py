"""
AI Assistant — powers "Let AI split" and "Let AI write" features.

Uses litellm to call an LLM (GPT-4o, Claude, Gemini, etc.) to generate
suggestions for the human player.
"""

from __future__ import annotations

import json
import re
from typing import Any

from config import AI_ASSISTANT_MODEL
from models import AISuggestRequest, AISuggestResponse


def _build_tone_instruction(modifiers: list[str]) -> str:
    """Convert tone modifier enums to natural language instruction."""
    if not modifiers:
        return ""
    parts = []
    for m in modifiers:
        m = m.replace("more_", "more ").replace("less_", "less ")
        parts.append(m)
    return f" Style: be {', '.join(parts)}."


async def suggest(
    req: AISuggestRequest,
    game_params: dict[str, Any],
    messages: list[dict[str, Any]],
    player_role: str,
) -> AISuggestResponse:
    """
    Generate an AI suggestion for split or message.

    Uses litellm for model-agnostic LLM calls.
    """
    try:
        import litellm
    except ImportError:
        # Fallback if litellm not installed
        return _fallback_suggest(req, game_params, player_role)

    money = game_params.get("money_to_divide", 10000)
    player_name = "Alice" if player_role == "alice" else "Bob"
    rival_name = "Bob" if player_role == "alice" else "Alice"

    tone_instr = _build_tone_instruction([m.value for m in req.tone_modifiers])

    # Build conversation summary
    conv_summary = ""
    for msg in messages[-10:]:  # Last 10 messages for context
        role = msg.get("role", "")
        content = msg.get("content", "")[:200]
        conv_summary += f"[{role}]: {content}\n"

    if req.suggest_type == "split":
        prompt = (
            f"You are advising {player_name} in a bargaining game. "
            f"The total amount to divide is ${money:,}. "
            f"{player_name}'s discount factor (delta) is {game_params.get('delta_player_1' if player_role == 'alice' else 'delta_player_2', game_params.get('delta', 'unknown'))}. "
            f"\n\nConversation so far:\n{conv_summary}\n"
            f"Suggest a fair but strategic split.{tone_instr} "
            f"Reply with ONLY a JSON object: "
            f'{{"alice_gain": <number>, "bob_gain": <number>}} '
            f"where the values sum to {money}."
        )
    else:
        prompt = (
            f"You are advising {player_name} in a bargaining game against {rival_name}. "
            f"The total amount is ${money:,}. "
            f"\n\nConversation so far:\n{conv_summary}\n"
            f"Current draft message: \"{req.current_message}\"\n"
            f"Write a persuasive message from {player_name} to {rival_name}.{tone_instr} "
            f"Reply with ONLY the message text (no JSON, no quotes)."
        )

    try:
        response = await litellm.acompletion(
            model=AI_ASSISTANT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.7,
        )
        text = response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[AI Assistant] LLM call failed: {e}")
        return _fallback_suggest(req, game_params, player_role)

    if req.suggest_type == "split":
        # Parse JSON from response
        match = re.search(r"\{.*?\}", text, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
                alice = float(data.get("alice_gain", money * 0.6))
                bob = float(data.get("bob_gain", money * 0.4))
                # Normalize to sum to money
                total = alice + bob
                if total > 0:
                    alice = round(alice / total * money)
                    bob = money - alice
                return AISuggestResponse(suggested_split={"alice": alice, "bob": bob})
            except (json.JSONDecodeError, ValueError):
                pass
        # Fallback
        return AISuggestResponse(suggested_split={"alice": round(money * 0.6), "bob": round(money * 0.4)})
    else:
        return AISuggestResponse(suggested_message=text)


def _fallback_suggest(
    req: AISuggestRequest,
    game_params: dict[str, Any],
    player_role: str,
) -> AISuggestResponse:
    """Simple fallback when LLM is unavailable."""
    money = game_params.get("money_to_divide", 10000)
    if req.suggest_type == "split":
        # Default: 60/40 in favor of proposer
        if player_role == "alice":
            return AISuggestResponse(suggested_split={"alice": round(money * 0.6), "bob": round(money * 0.4)})
        else:
            return AISuggestResponse(suggested_split={"alice": round(money * 0.4), "bob": round(money * 0.6)})
    else:
        return AISuggestResponse(suggested_message="I think a fair split would benefit us both. Let's find a deal we can agree on.")
