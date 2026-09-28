"""
Builds the runtime Vision board assets from the supplied design sheets.

Sources live in `design/vision-board/source/` (repo root) and are never
modified. Several sources are grouped exports (many objects on one large
transparent sheet); each object is found by connected-component analysis on
the alpha channel, so the script keeps working when a sheet is replaced with a
higher-resolution original of the same layout.

For every extracted object the script:
  - removes the red / yellow / pink / white matte fringes left by the
    background removal (region-grown in from the transparent edge only),
  - clears the stray residue inside torn-frame photo windows,
  - bleeds edge colour into transparent pixels so resizing leaves no halo,
  - resizes to a mobile-appropriate size and writes a lossy+alpha WebP.

It also writes `src/components/v2/vision/board/visionBoardAssetMetrics.generated.ts`
with each asset's aspect ratio and, for frames, the normalised photo window.

Usage (from anchor/mobile):  python scripts/vision-board/build_vision_board_assets.py
Requires: Pillow, numpy, scipy.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
MOBILE = os.path.abspath(os.path.join(HERE, '..', '..'))
REPO = os.path.abspath(os.path.join(MOBILE, '..', '..'))
SOURCE = os.path.join(REPO, 'design', 'vision-board', 'source')
OUT = os.path.join(MOBILE, 'src', 'assets', 'vision', 'board')
METRICS = os.path.join(MOBILE, 'src', 'components', 'v2', 'vision', 'board', 'visionBoardAssetMetrics.generated.ts')

WEBP_QUALITY = 86
ALPHA_THRESHOLD = 24


@dataclass
class Pick:
    sheet: str
    index: int  # object index in reading order (rows, then left to right)
    name: str
    max_dim: int  # longest side of the runtime asset, px
    kind: str = 'plain'  # plain | frame | board | paper


PICKS = [
    Pick('board-empty.webp', 0, 'board', 1600, 'board'),
    Pick('intention-paper.webp', 0, 'intention-paper', 1000, 'paper'),
    Pick('torn-frames-sheet.webp', 0, 'frame-landscape', 1100, 'frame'),
    Pick('torn-frames-sheet.webp', 1, 'frame-portrait', 1000, 'frame'),
    Pick('torn-frames-sheet.webp', 2, 'frame-square', 900, 'frame'),
    Pick('tape-pins-sheet.webp', 0, 'tape-light', 380),
    Pick('tape-pins-sheet.webp', 1, 'tape-kraft', 380),
    Pick('tape-pins-sheet.webp', 3, 'tape-soft', 380),
    Pick('tape-pins-sheet.webp', 4, 'pin-front', 120),
    Pick('tape-pins-sheet.webp', 5, 'pin-angled', 140),
    Pick('botanical-sheet.webp', 0, 'leaf-large', 720),
    Pick('botanical-sheet.webp', 1, 'leaf-branch', 640),
    Pick('botanical-sheet.webp', 2, 'leaf-sprig', 420),
    Pick('paper-map-sheet.webp', 0, 'scrap-kraft', 520),
    Pick('paper-map-sheet.webp', 1, 'map-corner', 520),
    Pick('paper-map-sheet.webp', 2, 'scrap-light', 520),
    Pick('paper-map-sheet.webp', 4, 'map-strip', 760),
    Pick('compass-sheet.webp', 1, 'compass-rose', 420),
]


def load(sheet: str) -> np.ndarray:
    return np.array(Image.open(os.path.join(SOURCE, sheet)).convert('RGBA'))


def objects(rgba: np.ndarray) -> list[tuple[slice, slice]]:
    """Bounding boxes of the sheet's objects in reading order."""
    mask = rgba[..., 3] > ALPHA_THRESHOLD
    closed = ndi.binary_closing(mask, iterations=3)
    labels, count = ndi.label(closed)
    boxes = ndi.find_objects(labels)
    sizes = ndi.sum(mask, labels, range(1, count + 1))
    minimum = mask.size * 0.0008
    found = [box for box, size in zip(boxes, sizes) if size > minimum]
    height = rgba.shape[0]

    def reading_order(box: tuple[slice, slice]) -> tuple[int, float]:
        cy = (box[0].start + box[0].stop) / 2
        cx = (box[1].start + box[1].stop) / 2
        return (round(cy / (height * 0.2)), cx)

    return sorted(found, key=reading_order)


def crop(rgba: np.ndarray, box: tuple[slice, slice], pad: int = 6) -> np.ndarray:
    h, w = rgba.shape[:2]
    y0, y1 = max(0, box[0].start - pad), min(h, box[0].stop + pad)
    x0, x1 = max(0, box[1].start - pad), min(w, box[1].stop + pad)
    piece = rgba[y0:y1, x0:x1].copy()
    # Neighbouring objects that fall inside the padded box are not ours.
    mask = piece[..., 3] > ALPHA_THRESHOLD
    labels, count = ndi.label(ndi.binary_closing(mask, iterations=3))
    if count > 1:
        sizes = ndi.sum(mask, labels, range(1, count + 1))
        keep = labels == (int(np.argmax(sizes)) + 1)
        keep = ndi.binary_dilation(keep, iterations=4)
        piece[..., 3] = np.where(keep, piece[..., 3], 0)
    return piece


def defringe(rgba: np.ndarray, band: int = 14) -> np.ndarray:
    """Removes matte-colour fringes, growing inward from the transparent edge only."""
    out = rgba.copy()
    r, g, b, a = (out[..., i].astype(np.int32) for i in range(4))
    transparent = a <= ALPHA_THRESHOLD
    distance = ndi.distance_transform_edt(~transparent)
    red = (r > 140) & (g * 100 < r * 55) & (b * 100 < r * 55) & (r - g > 70)
    yellow = (r > 170) & (g > 150) & (b * 10 < g * 6) & (np.abs(r - g) < 60) & (b < 110)
    pink = (r > 200) & (b > g + 5) & (r - g > 35)
    white = (np.minimum(np.minimum(r, g), b) > 226)
    key = ((red | yellow) & (distance <= band)) | ((pink | white) & (distance <= 4))
    removed = transparent.copy()
    for _ in range(band):
        frontier = ndi.binary_dilation(removed) & key & ~removed
        if not frontier.any():
            break
        removed |= frontier
    alpha = np.where(removed, 0, a)
    # Tighten the cut by a pixel and soften it so edges never read as stickers.
    alpha = ndi.grey_erosion(alpha, size=(3, 3))
    alpha = ndi.gaussian_filter(alpha.astype(np.float32), 0.6)
    out[..., 3] = np.clip(alpha, 0, 255).astype(np.uint8)
    return out


def clear_frame_window(rgba: np.ndarray) -> tuple[np.ndarray, dict]:
    """Empties the photo window and returns it as fractions of the frame."""
    out = rgba.copy()
    h, w = out.shape[:2]
    hole = out[..., 3] <= ALPHA_THRESHOLD
    labels, count = ndi.label(hole)
    best, best_size = None, 0
    for index, box in enumerate(ndi.find_objects(labels), start=1):
        touches = box[0].start == 0 or box[1].start == 0 or box[0].stop == h or box[1].stop == w
        size = int((labels[box] == index).sum())
        if not touches and size > best_size:
            best, best_size = box, size
    if best is None:
        raise RuntimeError('frame window not found')
    y0, y1, x0, x1 = best[0].start, best[0].stop, best[1].start, best[1].stop
    out[y0:y1, x0:x1, 3] = 0
    window = {'left': x0 / w, 'top': y0 / h, 'right': x1 / w, 'bottom': y1 / h}
    return out, window


def board_inner(rgba: np.ndarray) -> dict:
    """The linen field inside the wooden frame, as fractions of the board."""
    rgb = rgba[..., :3].astype(np.float32)
    lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    alpha = rgba[..., 3]
    h, w = lum.shape
    light = 150

    def first(values: np.ndarray, opacity: np.ndarray) -> int:
        # Skip the transparent margin, then the dark wood, to the first linen pixel.
        # Highlights on the wood are light too, so linen means a sustained run.
        start = int(np.argmax(opacity > 200))
        run = max(8, len(values) // 60)
        bright = (values[start:] > light).astype(np.int32)
        sustained = np.convolve(bright, np.ones(run, dtype=np.int32), mode='valid') == run
        return start + int(np.argmax(sustained))

    rows = [lum[int(h * f)] for f in (0.35, 0.5, 0.65)]
    row_alpha = [alpha[int(h * f)] for f in (0.35, 0.5, 0.65)]
    cols = [lum[:, int(w * f)] for f in (0.35, 0.5, 0.65)]
    col_alpha = [alpha[:, int(w * f)] for f in (0.35, 0.5, 0.65)]
    left = int(np.median([first(r, a) for r, a in zip(rows, row_alpha)]))
    right = w - int(np.median([first(r[::-1], a[::-1]) for r, a in zip(rows, row_alpha)]))
    top = int(np.median([first(c, a) for c, a in zip(cols, col_alpha)]))
    bottom = h - int(np.median([first(c[::-1], a[::-1]) for c, a in zip(cols, col_alpha)]))
    return {'left': left / w, 'top': top / h, 'right': right / w, 'bottom': bottom / h}


def bleed(rgba: np.ndarray) -> np.ndarray:
    """Copies the nearest visible colour into transparent pixels (no dark halos when scaled)."""
    out = rgba.copy()
    empty = out[..., 3] < 8
    if not empty.any() or empty.all():
        return out
    _, (iy, ix) = ndi.distance_transform_edt(empty, return_indices=True)
    for channel in range(3):
        values = out[..., channel]
        out[..., channel] = np.where(empty, values[iy, ix], values)
    return out


def resize(rgba: np.ndarray, max_dim: int) -> Image.Image:
    image = Image.fromarray(rgba, 'RGBA')
    scale = min(1.0, max_dim / max(image.size))
    if scale < 1.0:
        size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
        image = image.resize(size, Image.LANCZOS)
    return image


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    sheets: dict[str, tuple[np.ndarray, list]] = {}
    metrics: dict[str, dict] = {}
    for pick in PICKS:
        if pick.sheet not in sheets:
            rgba = load(pick.sheet)
            sheets[pick.sheet] = (rgba, objects(rgba))
        rgba, boxes = sheets[pick.sheet]
        piece = crop(rgba, boxes[pick.index])
        entry: dict = {}
        if pick.kind == 'board':
            piece = defringe(piece, band=4)
            entry['inner'] = board_inner(piece)
        elif pick.kind == 'frame':
            piece = defringe(piece)
            piece, window = clear_frame_window(piece)
            entry['window'] = window
        else:
            piece = defringe(piece)
        piece = bleed(piece)
        image = resize(piece, pick.max_dim)
        image.save(os.path.join(OUT, f'{pick.name}.webp'), 'WEBP', quality=WEBP_QUALITY, alpha_quality=92, method=6)
        entry['width'] = image.width
        entry['height'] = image.height
        entry['aspect'] = round(image.width / image.height, 4)
        metrics[pick.name] = entry
        print(f'{pick.name:18s} {image.width}x{image.height}', {k: v for k, v in entry.items() if k in ('window', 'inner')})

    def rounded(value):
        if isinstance(value, float):
            return round(value, 4)
        if isinstance(value, dict):
            return {k: rounded(v) for k, v in value.items()}
        return value

    body = json.dumps({k: rounded(v) for k, v in metrics.items()}, indent=2)
    with open(METRICS, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write('/* eslint-disable */\n')
        handle.write('// Generated by scripts/vision-board/build_vision_board_assets.py - do not edit by hand.\n')
        handle.write('// Pixel sizes of the runtime assets, with frame photo windows and the board\'s linen field as fractions.\n')
        handle.write(f'export const VISION_BOARD_ASSET_METRICS = {body} as const;\n')
    print('wrote', METRICS)


if __name__ == '__main__':
    main()
