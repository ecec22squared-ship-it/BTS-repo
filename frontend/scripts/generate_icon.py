"""One-shot script: generates a 1024x1024 galaxy app icon via Gemini Nano Banana
and saves it to /app/frontend/assets/images/icon-generated.png.

Run from /app:
    python frontend/scripts/generate_icon.py

Requires EMERGENT_LLM_KEY in /app/backend/.env.
"""
import asyncio
import base64
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / "backend" / ".env")

from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "assets" / "images" / "icon-generated.png"

PROMPT = (
    "A highly detailed, symmetrical spiral galaxy viewed face-on — deep royal purples and "
    "indigo in the outer arms, brilliant cyan and teal in the mid arms, a radiant warm "
    "golden-amber core at the center, sparse bright star clusters scattered throughout, "
    "matte-black space background, painterly cosmic texture, square 1024x1024 composition "
    "with the galaxy perfectly centered for use as a mobile-app icon. No text, no letters, "
    "no watermarks. Cinematic, iconic, instantly recognizable at small sizes."
)


async def main() -> int:
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        print("ERROR: EMERGENT_LLM_KEY is not set.")
        return 2

    chat = LlmChat(
        api_key=api_key,
        session_id="beyond-the-stars-icon-gen",
        system_message="You are a masterful sci-fi concept artist.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
        modalities=["image", "text"]
    )

    msg = UserMessage(text=PROMPT)
    try:
        _text, images = await chat.send_message_multimodal_response(msg)
    except Exception as e:
        print(f"ERROR calling Nano Banana: {e}")
        return 3

    if not images:
        print("No image returned.")
        return 4

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img = images[0]
    image_bytes = base64.b64decode(img["data"])
    OUT.write_bytes(image_bytes)
    print(f"Saved icon ({len(image_bytes)} bytes) -> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
