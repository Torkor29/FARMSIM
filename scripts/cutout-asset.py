#!/usr/bin/env python3
"""Détoure une illustration générée et l'exporte en WebP transparent.

Les modèles d'image rendent souvent la transparence sous forme d'un damier
gris et blanc *dessiné en pixels* : le fichier est opaque, et coller tel quel
sur la carte afficherait ce damier. On retire donc le fond par remplissage
depuis les bords — seuls les pixels clairs reliés au bord partent, ce qui
préserve les zones claires internes du sujet.

Usage : cutout-asset.py source.png destination.webp [--pad 8]
"""

from __future__ import annotations

import sys
from collections import deque

from PIL import Image

# Un damier de transparence n'est jamais saturé : il oscille entre le blanc et
# un gris clair. Le seuil retient cela sans mordre sur un sujet pâle.
MIN_LUMA = 200
MAX_CHROMA = 18


def is_background(px: tuple[int, int, int, int]) -> bool:
    r, g, b = px[0], px[1], px[2]
    return min(r, g, b) >= MIN_LUMA and (max(r, g, b) - min(r, g, b)) <= MAX_CHROMA


def cutout(src: str, dst: str, pad: int = 8) -> None:
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()

    seen = bytearray(w * h)
    queue: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        if not is_background(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    # Recadre sur le sujet, avec une marge : un sujet collé au bord se coupe
    # mal une fois mis à l'échelle dans la scène.
    box = im.getbbox()
    if box:
        left = max(0, box[0] - pad)
        top = max(0, box[1] - pad)
        right = min(w, box[2] + pad)
        bottom = min(h, box[3] + pad)
        im = im.crop((left, top, right, bottom))

    im.thumbnail((512, 512), Image.LANCZOS)
    im.save(dst, "WEBP", quality=90, method=6)
    opaque = sum(1 for p in im.getdata() if p[3] > 8)
    total = im.size[0] * im.size[1]
    print(f"{dst} — {im.size[0]}×{im.size[1]}, {100 * opaque // total} % de sujet")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        raise SystemExit(2)
    padding = 8
    if "--pad" in sys.argv:
        padding = int(sys.argv[sys.argv.index("--pad") + 1])
    cutout(sys.argv[1], sys.argv[2], padding)
