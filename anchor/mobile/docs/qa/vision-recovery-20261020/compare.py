"""Contact sheets from unaltered native captures; crops only isolate the supplied mockup panels."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent
ROOT = OUT.parents[4]
ATTACHMENTS = ROOT / '.codex-remote-attachments/01a15cbd-4189-7170-a2e5-84aea1d85e46'
APPROVED = ATTACHMENTS / '230868f1-f545-41cd-81e4-bc5f1f184fda'
BROKEN = ATTACHMENTS / '421954c7-c243-475e-ac81-2658b97c06ea'
FONT = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 22)

def panel(image, label, width=500, height=1080):
    canvas = Image.new('RGB', (width, height + 52), '#172129')
    draw = ImageDraw.Draw(canvas)
    draw.text((14, 12), label, font=FONT, fill='white')
    image = image.convert('RGB')
    scale = min(width / image.width, height / image.height)
    image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    canvas.paste(image, ((width - image.width) // 2, 52))
    return canvas

def row(name, items):
    panels = [panel(image, label) for image, label in items]
    result = Image.new('RGB', (sum(p.width for p in panels), panels[0].height), '#172129')
    x = 0
    for p in panels:
        result.paste(p, (x, 0))
        x += p.width
    result.save(OUT / name)

ref = Image.open(APPROVED / '2-165021.jpg')
row('board-side-by-side.jpg', [
    (ref.crop((5, 442, 159, 814)), 'Approved board (supplied crop)'),
    (Image.open(BROKEN / '2-165104.jpg'), 'Reported regression'),
    (Image.open(OUT / 'recovery-4-1.png'), 'Native recovery: 4 photos + note'),
])
row('composer-side-by-side.jpg', [
    (Image.open(APPROVED / '1-165025.jpg').crop((32, 307, 280, 989)), 'Approved note editor (crop)'),
    (Image.open(BROKEN / '1-165102.jpg'), 'Reported regression'),
    (Image.open(OUT / 'composer-tall-closed-final.png'), 'Native recovery: keyboard closed'),
    (Image.open(OUT / 'composer-keyboard.png'), 'Native recovery: keyboard open'),
])
row('board-count-matrix.jpg', [(Image.open(OUT / f'{name}.png'), label) for name, label in [
    ('recovery-1-0', '1 photo / no notes'), ('recovery-1-1', '1 photo / 1 note'),
    ('recovery-4-1', '4 photos / 1 note'), ('recovery-8-3', '8 photos / 3 notes'),
]])
if (OUT / 'visualize-entrance.png').exists():
    row('entrance-side-by-side.jpg', [
        (ref.crop((168, 442, 318, 814)), 'Approved Visualize entrance'),
        (Image.open(OUT / 'visualize-entrance-exact.png'), 'Native recovery: finished Anchor'),
    ])
