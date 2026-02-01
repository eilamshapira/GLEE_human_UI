#!/usr/bin/env python3
"""
Mock AI server for testing GLEE Human UI without a GPU.

Implements the same /chat protocol as lora_http_server but uses
simple heuristic responses instead of LLM inference.
"""

import json
import re
import random
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

app = FastAPI(title="Mock AI Player")


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    decision: bool = False
    game_params: Dict[str, Any] = {}


def _is_decision_turn(req: ChatRequest) -> bool:
    """
    Detect if this is a decision turn (accept/reject).

    GLEE's bargaining game does NOT set decision=True in the HTTP payload.
    We detect it from the prompt content: decision turns ask to accept or reject.
    """
    if req.decision:
        return True
    # Check the last user message for decision keywords
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


@app.post("/chat")
async def chat(req: ChatRequest):
    game_params = req.game_params
    money = game_params.get("money_to_divide", 10000)
    player_name = game_params.get("public_name", "Bob")

    is_decision = _is_decision_turn(req)

    if is_decision:
        # Decision turn: accept ~60% of the time, reject if unfair
        last_offer = None
        for msg in reversed(req.messages):
            match = re.search(r"\{.*?\}", msg.content, re.DOTALL)
            if match:
                try:
                    cleaned = re.sub(r"(?<=\d),(?=\d{3})", "", match.group())
                    data = json.loads(cleaned)
                    if "alice_gain" in data or "bob_gain" in data:
                        last_offer = data
                        break
                except (json.JSONDecodeError, ValueError):
                    pass

        # Simple logic: accept if AI gets >= 35%
        if last_offer:
            my_key = f"{player_name.lower()}_gain"
            my_gain = float(last_offer.get(my_key, 0))
            if money > 0 and my_gain / money >= 0.35:
                return {"response": json.dumps({"decision": "accept"})}

        # Sometimes accept anyway
        if random.random() < 0.3:
            return {"response": json.dumps({"decision": "accept"})}

        return {"response": json.dumps({"decision": "reject"})}

    else:
        # Proposal turn: propose ~55-65% for self
        my_pct = random.randint(55, 65)
        my_gain = round(money * my_pct / 100)
        rival_gain = money - my_gain

        player_lower = player_name.lower().replace(" ", "_")
        if player_lower == "alice":
            rival_lower = "bob"
        else:
            rival_lower = "alice"

        messages_list = [
            "I think this is a fair split given the circumstances.",
            "Let's be reasonable here - this works for both of us.",
            "I believe this allocation reflects our positions well.",
            "How about this? I think we can both benefit.",
            "This is my best offer. Let's close the deal.",
        ]

        response = {
            f"{player_lower}_gain": my_gain,
            f"{rival_lower}_gain": rival_gain,
        }

        # Add message if messages are allowed
        if game_params.get("messages_allowed", True):
            response["message"] = random.choice(messages_list)

        return {"response": json.dumps(response)}


@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": True, "device": "mock"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
