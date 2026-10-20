"""Inspect exported alpha and dimensions without modifying images (requires Pillow)."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2] / 'src/assets/vision/materials'
inventory = json.loads((root / 'inventory.json').read_text())
assert len(inventory) == 26
for item in inventory:
    path = root / item['filename']
    image = Image.open(path).convert('RGBA')
    assert image.size == (item['width'], item['height']), path.name
    alpha = image.getchannel('A')
    low, high = alpha.getextrema()
    assert low == 0 and high > 0, path.name
    if path.name.startswith('polaroid-'):
        bottom = 504 if path.name == 'polaroid-wide-bottom.webp' else 562
        assert alpha.crop((36, 43, 564, bottom)).getextrema() == (0, 0), path.name
        assert sum(alpha.getpixel(point) for point in [(0, 0), (599, 0), (0, 719), (599, 719)]) < 12, path.name
    elif path.name.startswith('tape-'):
        assert high < 180, path.name
    else:
        assert alpha.getpixel((300, 300)) > 245, path.name
        thumbnail = Image.open(root / 'thumbnails' / path.name)
        assert thumbnail.size == (128, 128), path.name
total = sum(path.stat().st_size for path in root.rglob('*.webp'))
assert total < 1_200_000
print(f'PASS: {len(inventory)} materials, 16 thumbnails, {total:,} bytes; dimensions, alpha, frame apertures and tape translucency checked.')
