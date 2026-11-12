"""Builds the release screenshots from raw window captures.

    python3 -I scripts/build-screenshots.py <raw folder>

Each <raw folder>/NN-name.png (a `screencapture -o -l <window>` of the game window) becomes:

    docs/steam-screenshots/NN-name.jpg   1920x1200, for the Steam Workshop page
    docs/screenshots/NN-name.jpg         1280x800, for the README and the GitHub release

A title bar, when the capture has one, is cut off; the rest is trimmed to 16:10 and scaled.

CROPS can add zoomed-in close-ups of one part of a capture, numbered in sequence with the full shots, at 1600 (Steam)
and 960 (GitHub) pixels wide. The JPEGs are written from the
pixels alone, so they carry no EXIF, XMP, colour profile or capture date. Run with --check to confirm that every
output has no metadata and the right size.
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = {
    "steam": (os.path.join(ROOT, "docs", "steam-screenshots"), (1920, 1200)),
    "github": (os.path.join(ROOT, "docs", "screenshots"), (1280, 800)),
}
# Close-ups: name -> (source capture, box in the units of a 1400-pixel-wide view of the whole capture). None yet.
CROPS = {}
CROP_WIDTH = {"steam": 1600, "github": 960}
# The macOS title bar of the game window, in pixels at 2x (28 points).
TITLE_BAR = 56
RATIO = 16 / 10


def crop(img):
    w, h = img.size
    # A capture of the whole window carries the title bar and is that much taller than 16:10; one of the game's
    # content alone (3024x1890) has none to cut.
    if h - round(w / RATIO) >= TITLE_BAR - 8:
        img = img.crop((0, TITLE_BAR, w, h))
    w, h = img.size
    if w / h > RATIO:
        # Trimmed evenly from both sides: the screens sit in the middle of the window.
        nw = round(h * RATIO)
        left = (w - nw) // 2
        return img.crop((left, 0, left + nw, h))
    nh = round(w / RATIO)
    top = (h - nh) // 2
    return img.crop((0, top, w, top + nh))


def clean(img):
    # A fresh image from the pixels alone: nothing from the source's info dictionary comes along.
    rgb = img.convert("RGB")
    return Image.frombytes("RGB", rgb.size, rgb.tobytes())


def build(raw):
    names = sorted(n for n in os.listdir(raw) if n.lower().endswith(".png") and n[:2].isdigit())
    # Start clean, so a renamed or dropped shot leaves no stale copy behind.
    for folder, _ in OUT.values():
        os.makedirs(folder, exist_ok=True)
        for old in os.listdir(folder):
            if old.endswith(".jpg"):
                os.remove(os.path.join(folder, old))
    for name in names:
        base = clean(crop(Image.open(os.path.join(raw, name))))
        for folder, size in OUT.values():
            dest = os.path.join(folder, os.path.splitext(name)[0] + ".jpg")
            base.resize(size, Image.LANCZOS).save(dest, "JPEG", quality=88, optimize=True, progressive=True)
            print(f"wrote {os.path.relpath(dest, ROOT)}")
    for name, (source, box) in CROPS.items():
        if source not in names:
            continue
        img = Image.open(os.path.join(raw, source))
        k = img.width / 1400
        part = clean(img.crop(tuple(round(v * k) for v in box)))
        for key, (folder, _) in OUT.items():
            w = CROP_WIDTH[key]
            h = round(part.height * w / part.width)
            dest = os.path.join(folder, name + ".jpg")
            part.resize((w, h), Image.LANCZOS).save(dest, "JPEG", quality=90, optimize=True, progressive=True)
            print(f"wrote {os.path.relpath(dest, ROOT)}")


def has_metadata(path):
    with open(path, "rb") as f:
        data = f.read()
    # APP1 (EXIF or XMP), APP2 (ICC profile), APP13 (IPTC) and comment markers.
    return any(marker in data for marker in (b"\xff\xe1", b"\xff\xe2", b"\xff\xed", b"\xff\xfe"))


def check():
    bad = []
    for folder, size in OUT.values():
        for name in sorted(os.listdir(folder)):
            path = os.path.join(folder, name)
            img = Image.open(path)
            stem = os.path.splitext(name)[0]
            want = size if stem not in CROPS else (CROP_WIDTH["steam" if folder == OUT["steam"][0] else "github"], img.height)
            if img.size != want or img.info.get("exif") or img.info.get("icc_profile") or has_metadata(path):
                bad.append(os.path.relpath(path, ROOT))
    for b in bad:
        print(f"not clean or wrong size: {b}")
    return not bad


if __name__ == "__main__":
    if "--check" in sys.argv:
        sys.exit(0 if check() else 1)
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    build(sys.argv[1])
    sys.exit(0 if check() else 1)
