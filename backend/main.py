import os
from dotenv import load_dotenv
load_dotenv() 

import urllib.parse
import random
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse # <-- ADDED FileResponse
from fastapi.staticfiles import StaticFiles # <-- ADDED StaticFiles
from pydantic import BaseModel
from typing import List, Optional
from openai import AsyncOpenAI

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenRouter Configuration
# Make sure it explicitly uses the OPENROUTER_API_KEY secret
client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY")
)

class Message(BaseModel):
    role: str
    content: str
    image: Optional[str] = None

class ChatPayload(BaseModel):
    messages: List[Message]
    is_image_request: bool = False

async def stream_processor(payload: ChatPayload):
    try:
        latest_msg = payload.messages[-1].content
        
        # Image Generation Route
        if payload.is_image_request:
            prompt = urllib.parse.quote(latest_msg)
            seed = random.randint(1000, 99999)
            image_url = f"https://image.pollinations.ai/prompt/{prompt}?width=1024&height=1024&seed={seed}&nologo=true"
            yield f"![Generated Image]({image_url})"
            return

        or_messages = []
        for msg in payload.messages:
            if msg.role == "system": 
                continue
            
            if msg.image:
                or_messages.append({
                    "role": "user",
                    "content": [
                        {"type": "text", "text": msg.content},
                        {"type": "image_url", "image_url": {"url": msg.image}}
                    ]
                })
            else:
                role_mapping = "assistant" if msg.role == "assistant" else "user"
                or_messages.append({"role": role_mapping, "content": msg.content})

        response = await client.chat.completions.create(
            model="google/gemini-2.5-flash",
            messages=or_messages,
            stream=True,
            max_tokens=2000 # <--- Fixes the 402 "Too many credits" Error
        )

        async for chunk in response:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    except Exception as e:
        yield f"\n\n**API Error:** {str(e)}"
# --- ADD THIS BLOCK ---
@app.post("/chat")
async def chat_endpoint(payload: ChatPayload):
    return StreamingResponse(stream_processor(payload), media_type="text/event-stream")
# ----------------------