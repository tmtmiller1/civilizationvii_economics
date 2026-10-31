#!/usr/bin/env python3
"""draw-gauges.py - draws the Economics screen's cycle dial (its face and needle) as PNG files in images/ (the page doesn't draw
SVG pictures inside an <img>-style background reliably, so the instruments are files, as Zoom, Tilt and Rotate's are).

Each face is a half arc from the left (the scale's low end) over the top to the right, with the needle's pivot half
way across and 70% of the way down, so one needle serves every face: CSS turns it from -90deg (low) to +90deg (high)
about "50% 70%". Drawn four times larger and scaled down for smooth edges. Run after changing a band:
    python3 scripts/draw-gauges.py
"""
import math
import os
from PIL import Image, ImageDraw

SIZE = 512
K = 4
CX, CY = 256, 358
CREAM = (236, 223, 191)
GILT = (196, 163, 98)
GOLD = (232, 200, 103)
COPPER = (154, 91, 46)
RED = (168, 32, 26)
DARK = (27, 23, 17)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "images")


def canvas():
    return Image.new("RGBA", (SIZE * K, SIZE * K), (0, 0, 0, 0))


def arc(draw, radius, start, end, colour, width, alpha=255):
    """An arc from start to end as fractions of the scale (0 = left, 1 = right)."""
    r = radius * K
    box = [CX * K - r, CY * K - r, CX * K + r, CY * K + r]
    draw.arc(box, 180 + 180 * start, 180 + 180 * end, fill=colour + (alpha,), width=width * K)


def tick(draw, frac, inner, outer, colour, width, alpha=255):
    angle = math.radians(180 + 180 * frac)
    x0, y0 = CX + inner * math.cos(angle), CY + inner * math.sin(angle)
    x1, y1 = CX + outer * math.cos(angle), CY + outer * math.sin(angle)
    draw.line([x0 * K, y0 * K, x1 * K, y1 * K], fill=colour + (alpha,), width=width * K)


def face(name, bands, marks):
    """bands: (start, end, colour, alpha); marks: fractions that get a long cream tick."""
    img = canvas()
    d = ImageDraw.Draw(img)
    arc(d, 214, 0, 1, CREAM, 4, 200)
    for start, end, colour, alpha in bands:
        arc(d, 194, start, end, colour, 11, alpha)
    for k in range(21):
        tick(d, k / 20, 204, 212, CREAM, 2, 120)
    for k in range(5):
        tick(d, k / 4, 198, 214, CREAM, 3, 170)
    for frac in [0, 1] + marks:
        tick(d, frac, 180, 224, CREAM, 4, 230)
    small = img.resize((SIZE, SIZE), Image.LANCZOS)
    small.save(os.path.join(OUT, f"econ-gauge-{name}.png"))


def needle():
    img = canvas()
    d = ImageDraw.Draw(img)

    def shape(grow):
        return [(CX * K, (CY - 192 - grow) * K), ((CX + 7 + grow) * K, CY * K), ((CX + 4 + grow) * K, (CY + 30 + grow) * K),
                ((CX - 4 - grow) * K, (CY + 30 + grow) * K), ((CX - 7 - grow) * K, CY * K)]
    d.polygon(shape(3), fill=DARK + (220,))
    d.polygon(shape(0), fill=GOLD + (255,))
    for r, colour in ((22, DARK), (16, GILT), (6, DARK)):
        d.ellipse([(CX - r) * K, (CY - r) * K, (CX + r) * K, (CY + r) * K], fill=colour + (255,))
    img.resize((SIZE, SIZE), Image.LANCZOS).save(os.path.join(OUT, "econ-gauge-needle.png"))


if __name__ == "__main__":
    # The business cycle, index 0.50 to 1.50 (E runs 0.70 to 1.30 and a civ's own push adds at most 0.20 either way):
    # Depression below 0.80, Slump below 0.95, Steady to 1.05, Boom above (econ-params.js CYCLE_RULES).
    lo, hi = 0.5, 1.5
    f = lambda v: (v - lo) / (hi - lo)
    face("cycle", [(0, f(0.8), RED, 235), (f(0.8), f(0.95), COPPER, 235), (f(0.95), f(1.05), GILT, 255),
                   (f(1.05), 1, GOLD, 200)], [f(0.8), f(0.95), f(1.05)])
    needle()
    print("drew", sorted(n for n in os.listdir(OUT) if n.startswith("econ-gauge")))
