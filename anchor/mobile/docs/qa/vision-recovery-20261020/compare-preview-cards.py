"""Proportional crops of native cards; originals and native bounds remain alongside."""
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent
FONT = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 23)

def card(surface):
    identity = 'v2-home-vision' if surface.startswith('home') else 'v2-details-vision'
    root = ET.parse(OUT / f'card-{surface}.xml').getroot()
    node = next(node for node in root.iter('node') if node.get('resource-id') == identity)
    bounds = tuple(map(int, re.findall(r'\d+', node.get('bounds'))))
    return Image.open(OUT / f'card-{surface}.png').crop(bounds)

def panel(image, label, width=620, height=580):
    canvas = Image.new('RGB', (width, height), '#172129')
    ImageDraw.Draw(canvas).text((14, 12), label, font=FONT, fill='white')
    scale = min((width - 28) / image.width, (height - 70) / image.height)
    image = image.convert('RGB').resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    canvas.paste(image, ((width - image.width) // 2, 60))
    return canvas

rows = [('1-notes', '1 photo + 1 note'), ('2', '2 photos'), ('8-notes', '8 photos + 1 note'), ('0-notes', 'Notes only')]
matrix = Image.new('RGB', (1240, 580 * len(rows)), '#172129')
for row, (suffix, label) in enumerate(rows):
    for col, variant in enumerate(('home', 'details')):
        matrix.paste(panel(card(f'{variant}-{suffix}'), f'{variant.title()}: {label}'), (col * 620, row * 580))
matrix.save(OUT / 'preview-cards-matrix.jpg')

supplied = OUT.parents[4] / '.codex-remote-attachments/01a15cbd-4189-7170-a2e5-84aea1d85e46/b285e49f-b510-4375-872b-105be11c66ca/1-165119.jpg'
comparison = Image.new('RGB', (1860, 580), '#172129')
images = [(Image.open(supplied).crop((32, 777, 596, 1189)), 'Reported Home card (crop)'),
          (card('home-1-notes'), 'Repaired native Home card'),
          (card('details-1-notes'), 'Repaired native Details card')]
for col, (image, label) in enumerate(images):
    comparison.paste(panel(image, label), (col * 620, 0))
comparison.save(OUT / 'preview-cards-comparison.jpg')
