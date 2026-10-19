"""Renders the Home hero's construction ring to assets/home/construction-ring.png.

The ring used to be a react-native-svg <Circle> whose bitmap is re-rasterized on the main thread every
time its SvgView attaches. It is a fixed shape, so it is drawn once here as a white alpha mask and shown
with an Image + tintColor. The geometry mirrors the former ConstructionStrokes exactly (all values are
fractions of the square's side `S`, with stroke taken at the S24's 245 dp reference size):

  circle centre (c - 0.005 S, c + 0.004 S), radius 0.452 S, stroke 1.2 dp, round caps,
  dasharray [5.4 r, 0.5 r] (r = radius), whole group rotated -24 degrees about (c, c).
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

SIDE = 1024            # output pixels
SUPER = 4              # supersampling for clean anti-aliasing
REFERENCE_DP = 245.0   # constructionSize on the reference device
STROKE_DP = 1.2
ROTATE_DEG = -24.0

S = SIDE * SUPER
c = S / 2
radius = 0.452 * S
px_per_dp = S / REFERENCE_DP
stroke = STROKE_DP * px_per_dp

# centre offset, then rotated about (c, c)
dx, dy = -0.005 * S, 0.004 * S
rot = math.radians(ROTATE_DEG)
cx = c + dx * math.cos(rot) - dy * math.sin(rot)
cy = c + dx * math.sin(rot) + dy * math.cos(rot)

img = Image.new('L', (S, S), 0)
d = ImageDraw.Draw(img)
bbox = [cx - radius, cy - radius, cx + radius, cy + radius]

# SVG angles run clockwise from 3 o'clock, as PIL's do. Dash 5.4 rad, gap 0.5 rad, then the remainder.
two_pi = 2 * math.pi
dashes = [(0.0, 5.4), (5.9, two_pi)]
for start, end in dashes:
    a0 = math.degrees(start) + ROTATE_DEG
    a1 = math.degrees(end) + ROTATE_DEG
    d.arc(bbox, a0, a1, fill=255, width=round(stroke))
    for a in (a0, a1):  # round caps
        x = cx + radius * math.cos(math.radians(a))
        y = cy + radius * math.sin(math.radians(a))
        d.ellipse([x - stroke / 2, y - stroke / 2, x + stroke / 2, y + stroke / 2], fill=255)

mask = img.resize((SIDE, SIDE), Image.LANCZOS)
out = Image.new('RGBA', (SIDE, SIDE), (255, 255, 255, 0))
out.putalpha(mask)
path = Path(__file__).resolve().parent.parent / 'assets' / 'home' / 'construction-ring.png'
out.save(path, optimize=True)
print(path, path.stat().st_size, 'bytes')
