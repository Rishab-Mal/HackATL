"""AI chatbot endpoint — proxies messages to OpenRouter. Owned by Person 3/4."""

import os
from typing import List

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/chat", tags=["chat"])

SYSTEM_PROMPT = """You are FibrBot, a friendly assistant built into fibr — a B2B platform that turns textile factory fabric scraps into a circular supply chain through computer vision sorting, AI pricing, and a marketplace connecting manufacturers with recyclers and makers.

The platform has three portals:
- Factory portal: Workers photograph scrap piles. Computer vision detects and groups fabric pieces by color and type in under 30 seconds — no manual data entry. Each group becomes a sellable "lot" listed automatically.
- Admin portal: Dashboard showing P&L, lot inventory, environmental impact metrics (CO₂ saved, water saved, fabric diverted), buyer activity, and AI-powered decay alerts. Lots can be delisted or relisted.
- Buyer portal: Recyclers, makers, and resellers browse available lots, filter by fabric type and color, set quantity with a slider, and claim lots in one click. Ships within 48 hours.

fibr is live in a pilot with Carter's suppliers in Atlanta. Every lot traces back to a factory production record — buyers get full traceability on fabric type, composition, weight, and origin.

AI pricing: lots start at a base price, then decay daily (floor at 35%) to ensure inventory turns quickly. The longer a lot sits, the cheaper it gets — buyers are incentivized to act fast.

Environmental impact: every claimed lot generates real CO₂ and water savings data. These numbers are tracked, aggregated, and visible across the platform.

Be concise, warm, and helpful. Guide users through fibr, explain features, and answer questions about fabric recycling, the circular economy, or textile sustainability."""


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]


class ChatResponse(BaseModel):
    reply: str


@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest):
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY not set")

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:5173",
                    "X-Title": "fibr",
                },
                json={
                    "model": "openai/gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        *[m.model_dump() for m in body.messages],
                    ],
                    "max_tokens": 300,
                },
                timeout=30.0,
            )
            res.raise_for_status()
            data = res.json()
            reply = data["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"OpenRouter error: {e.response.text}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach OpenRouter: {type(e).__name__}")
    except (KeyError, IndexError):
        raise HTTPException(status_code=502, detail="Unexpected response format from OpenRouter")

    return ChatResponse(reply=reply)
