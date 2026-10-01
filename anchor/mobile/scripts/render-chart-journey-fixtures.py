"""Geometry-only image fixtures. Not evidence of native rendering or performance."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
data = json.loads((root / 'docs/qa/chart-journey/geometry-captures.json').read_text())
assets = root / 'src/assets/chart/world/runtime'
sources = dict(zip(['sky', 'city', 'midground', 'road', 'foreground'], [
    'chart_01_sky.jpg', 'chart_02_city.png', 'chart_03_midground.png',
    'chart_04_road.png', 'chart_05_foreground.png']))
states = [s for s in data['states'] if s['size']['name'] == 'iphone-14-pro' and s['count'] == 5]
gallery = Image.new('RGB', (393 * len(states), 500))
for index, state in enumerate(states):
    canvas = Image.new('RGBA', (393, 500), '#101b25')
    camera = state['camera']
    layers = {layer['id']: layer for layer in state['layers']}
    for name in ['sky', 'midground', 'city', 'road', 'foreground']:
        layer = layers[name]
        rect, offset = layer['rect'], layer['offset']
        texture = Image.open(assets / sources[name]).convert('RGBA')
        texture = texture.resize((round(camera['width'] * rect['scale']), round(camera['height'] * rect['scale'])), Image.Resampling.LANCZOS)
        if name == 'city':
            import numpy as np
            pixels = np.array(texture)
            rows, columns = pixels.shape[:2]
            horizontal = np.minimum(np.clip(np.linspace(0, 1, columns) / .06, 0, 1), np.clip((1 - np.linspace(0, 1, columns)) / .06, 0, 1))
            vertical = np.clip((.69 - np.linspace(0, 1, rows)) / .11, 0, 1)
            pixels[:, :, 3] = (pixels[:, :, 3] * vertical[:, None] * horizontal[None, :]).astype('uint8')
            texture = Image.fromarray(pixels)
        canvas.alpha_composite(texture, (round(camera['left'] + camera['width'] * (rect['x'] + offset['x'])), round(camera['top'] + camera['height'] * (rect['y'] + offset['y']))))
    draw = ImageDraw.Draw(canvas)
    for node in state['nodes']:
        x, y = node['screen']['x'], node['screen']['y']
        draw.ellipse((x-7, y-7, x+7, y+7), fill='#10212a', outline='#f2e6cb')
    draw.text((10, 10), str(state['progress']), fill='white')
    gallery.paste(canvas.convert('RGB'), (index*393, 0))
gallery.save(root / 'docs/qa/chart-journey/registered-camera-fixtures.jpg', quality=95)
