"""Generate Google Play feature graphic (1024x500) from the existing galaxy icon.

We don't re-query the LLM — we compose the existing galaxy icon onto a wide canvas
with a gradient and the 'Beyond the Stars / Live Your Adventure' wordmark.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path("/app/frontend")
ICON = ROOT / "assets" / "images" / "icon-generated.png"
OUT = ROOT / "store_assets" / "feature-graphic-1024x500.png"
OUT.parent.mkdir(parents=True, exist_ok=True)

W, H = 1024, 500

# Gradient background: deep navy -> violet-black
bg = Image.new("RGB", (W, H), (5, 5, 15))
dg = ImageDraw.Draw(bg)
for y in range(H):
    # subtle vertical gradient
    t = y / H
    r = int(8 + 12 * (1 - t))
    g = int(6 + 6 * (1 - t))
    b = int(20 + 22 * (1 - t))
    dg.line([(0, y), (W, y)], fill=(r, g, b))

# Place the galaxy icon on the right third, scaled down and with a soft glow
icon = Image.open(ICON).convert("RGBA")
icon_size = 420
icon = icon.resize((icon_size, icon_size), Image.LANCZOS)

# Glow
glow = icon.copy().filter(ImageFilter.GaussianBlur(radius=30))
glow_alpha = glow.split()[3].point(lambda a: int(a * 0.55))
glow.putalpha(glow_alpha)

icon_x = W - icon_size - 40
icon_y = (H - icon_size) // 2
bg.paste(glow, (icon_x - 10, icon_y - 10), glow)
bg.paste(icon, (icon_x, icon_y), icon)

# Star speckle on the left half
import random
random.seed(7)
dots = ImageDraw.Draw(bg)
for _ in range(120):
    x = random.randint(0, icon_x - 30)
    y = random.randint(0, H - 1)
    size = random.choice([1, 1, 1, 2, 2, 3])
    brightness = random.randint(140, 240)
    dots.ellipse((x, y, x + size, y + size), fill=(brightness, brightness, 255))

# Text: title + tagline
draw = ImageDraw.Draw(bg)

# Find a system font
font_paths = [
    "/usr/share/fonts/truetype/dejavu/DejaVu-Sans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
]
title_font = None
for p in font_paths:
    if Path(p).exists():
        title_font = ImageFont.truetype(p, 82)
        sub_font = ImageFont.truetype(p, 36)
        micro_font = ImageFont.truetype(p, 22)
        break
if title_font is None:
    title_font = ImageFont.load_default()
    sub_font = ImageFont.load_default()
    micro_font = ImageFont.load_default()

# Title
title = "BEYOND THE STARS"
tx, ty = 60, 150
# soft shadow
for off in [(3, 3), (2, 2), (1, 1)]:
    draw.text((tx + off[0], ty + off[1]), title, font=title_font, fill=(0, 0, 0))
draw.text((tx, ty), title, font=title_font, fill=(255, 215, 0))  # gold

# Tagline
tagline = "Live Your Adventure"
draw.text((tx + 2, 260 + 2), tagline, font=sub_font, fill=(0, 0, 0))
draw.text((tx, 260), tagline, font=sub_font, fill=(94, 200, 255))  # cyan

# Under-line strap
strap = "An AI Game Master · Galactic Text RPG"
draw.text((tx, 320), strap, font=micro_font, fill=(170, 180, 220))

# Save
bg.save(OUT, "PNG", optimize=True)
print(f"Saved feature graphic -> {OUT}  ({OUT.stat().st_size} bytes)")
