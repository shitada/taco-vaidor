#!/usr/bin/env python3
"""Generate Taco-Vaidor app icons (iPad / iOS home screen + PWA + favicon).

Renders a single high-resolution master image — the game's magenta octopus
invader on the dark starfield, holding a little taco — then downscales it to
every size the site references. Run from the repo root:

    python3 tools/generate_icons.py
"""
import os
import random

from PIL import Image, ImageDraw, ImageFilter

M = 1024          # master render size (px)
S = 256           # design grid
k = M / S         # design -> pixel scale
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "icons")

# Game palette
BG_TOP = (26, 37, 64)
BG_BOT = (11, 14, 23)
HEAD = (210, 90, 180, 255)
HEAD_RIM = (170, 60, 140, 255)
TENT = (200, 80, 170, 255)
ACCENT = (255, 210, 74)


def b(x0, y0, x1, y1):
    """Scale a design-grid box to pixels."""
    return [x0 * k, y0 * k, x1 * k, y1 * k]


def lerp(a, c, t):
    return tuple(int(a[i] + (c[i] - a[i]) * t) for i in range(3))


def render_master():
    img = Image.new("RGBA", (M, M), BG_BOT + (255,))
    d = ImageDraw.Draw(img)

    # Vertical background gradient
    for y in range(M):
        d.line([(0, y), (M, y)], fill=lerp(BG_TOP, BG_BOT, y / (M - 1)) + (255,))

    # Soft magenta glow behind the character
    glow = Image.new("RGBA", (M, M), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse(b(46, 36, 210, 198), fill=(140, 60, 160, 110))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(k * 16)))
    d = ImageDraw.Draw(img)

    # Starfield
    random.seed(7)
    for _ in range(70):
        x = random.uniform(0, M)
        y = random.uniform(0, M * 0.82)
        r = random.choice([1, 1, 1, 2]) * k * 0.7
        a = random.randint(110, 235)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(230, 230, 255, a))

    # Drop shadow under the octopus
    sh = Image.new("RGBA", (M, M), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse(b(72, 198, 184, 232), fill=(0, 0, 0, 130))
    img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(k * 6)))
    d = ImageDraw.Draw(img)

    # Tentacles (drawn before the head so the head overlaps them)
    n = 6
    x0, x1 = 64, 192
    gap = (x1 - x0) / (n - 1)
    for i in range(n):
        cx = x0 + gap * i
        d.rounded_rectangle(b(cx - 10, 150, cx + 10, 212), radius=10 * k, fill=TENT)

    # Head
    d.ellipse(b(48, 46, 208, 178), fill=HEAD)
    d.ellipse(b(48, 46, 208, 178), outline=HEAD_RIM, width=int(3 * k))

    # Eyes (whites, pupils, highlights)
    for ex in (106, 150):
        d.ellipse(b(ex - 17, 94, ex + 17, 128), fill=(255, 255, 255, 255))
    for ex in (110, 146):
        d.ellipse(b(ex - 10, 106, ex + 10, 126), fill=(22, 22, 32, 255))
        d.ellipse(b(ex - 7, 108, ex - 1, 114), fill=(255, 255, 255, 255))

    # Little smile
    d.arc(b(116, 130, 140, 156), start=15, end=165, fill=(140, 45, 100, 255), width=int(3 * k))

    # Taco accent (held at the bottom-center)
    d.pieslice(b(106, 202, 150, 246), 0, 180, fill=(240, 196, 72, 255))   # shell
    d.rounded_rectangle(b(108, 206, 148, 214), radius=4 * k, fill=(86, 170, 84, 255))  # lettuce
    d.rounded_rectangle(b(112, 203, 144, 210), radius=4 * k, fill=(208, 76, 64, 255))  # filling

    # Subtle accent inner border (matches the iOS rounded-square mask)
    border = Image.new("RGBA", (M, M), (0, 0, 0, 0))
    ImageDraw.Draw(border).rounded_rectangle(
        b(7, 7, 249, 249), radius=54 * k, outline=ACCENT + (90,), width=int(3 * k)
    )
    img = Image.alpha_composite(img, border)

    return img.convert("RGB")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    master = render_master()

    targets = {
        "icon-512.png": 512,
        "icon-192.png": 192,
        "apple-touch-icon.png": 180,
        "apple-touch-icon-167x167.png": 167,
        "apple-touch-icon-152x152.png": 152,
        "favicon-32.png": 32,
    }
    for name, size in targets.items():
        master.resize((size, size), Image.LANCZOS).save(os.path.join(OUT_DIR, name))
        print(f"wrote icons/{name} ({size}x{size})")


if __name__ == "__main__":
    main()
