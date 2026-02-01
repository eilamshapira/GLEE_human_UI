#!/usr/bin/env python3
"""
LLM-based AI server for GLEE Human UI.

Uses litellm to call any LLM (Gemini, GPT-4o, Claude, etc.)
and implements the GLEE /chat protocol.
"""

import json
import os
import argparse
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict, Any
import litellm

app = FastAPI(title="LLM AI Player")

MODEL = "vertex_ai/gemini-2.5-flash"


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    decision: bool = False
    game_params: Dict[str, Any] = {}


@app.post("/chat")
async def chat(req: ChatRequest):
    # Convert messages to litellm format
    messages = []
    for msg in req.messages:
        role = msg.role
        # litellm expects "user", "assistant", "system"
        if role not in ("user", "assistant", "system"):
            role = "user"
        messages.append({"role": role, "content": msg.content})

    try:
        response = await litellm.acompletion(
            model=MODEL,
            messages=messages,
            max_tokens=512,
            temperature=0.7,
        )
        text = response.choices[0].message.content.strip()
        return {"response": text}
    except Exception as e:
        print(f"[LLM Error] {e}")
        # Return empty response on error (GLEE will handle it)
        return {"response": ""}


@app.get("/health")
async def health():
    return {"status": "healthy", "model": MODEL, "device": "api"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="vertex_ai/gemini-2.5-flash")
    parser.add_argument("--port", type=int, default=5001)
    args = parser.parse_args()
    MODEL = args.model

    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=args.port)
