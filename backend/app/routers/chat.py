"""AI chatbot endpoint — proxies messages to OpenRouter. Owned by Person 3/4."""

import os
from typing import List

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/chat", tags=["chat"])

SYSTEM_PROMPT = """You are Reweave Assistant, a friendly assistant built into Reweave — a B2B platform that helps textile factories sort fabric scraps and connect them with recyclers and makers, reducing landfill waste.

The app has 4 pages:
- Capture: Upload a photo of a scrap pile. Computer vision detects and groups pieces by color. From each group you can create a sellable "lot".
- Sorted Lots: All created lots with fabric type, composition, weight, price, and environmental impact (CO2 + water saved).
- Marketplace: Available lots alongside buyer profiles (recyclers and makers). Match lots to the right buyer and claim them.
- Impact Dashboard: Running totals — fabric diverted from landfill, CO2 saved, water saved, lots claimed.

The platform is piloting with Carter's suppliers. Every lot is created straight from a camera scan — computer vision identifies the fabric type, composition, color, and piece count — so buyers know exactly what they're getting.

Be concise, warm, and helpful. Guide users through the app, explain features, and answer questions about fabric recycling or the platform."""


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
                    "X-Title": "Reweave",
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
        raise HTTPException(status_code=502, detail=f"Could not reach OpenRouter: {e}")
    except (KeyError, IndexError):
        raise HTTPException(status_code=502, detail="Unexpected response from OpenRouter")

    return ChatResponse(reply=reply)
