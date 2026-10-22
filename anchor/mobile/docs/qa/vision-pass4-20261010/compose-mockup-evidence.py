from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).parent
reference = Image.open('E:/Projects/Anchor/.codex-remote-attachments/01a12721-8378-7e73-b66d-0c5e5501d684/2b092cbb-e30d-4773-8d35-f77e02ab9a85/1-163920.png')
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 20)

def panel(images, labels, name, columns=2, width=472):
    resized = [image.resize((width, round(image.height * width / image.width))) for image in images]
    height = max(image.height for image in resized) + 46
    canvas = Image.new('RGB', (columns * (width + 24) + 24, ((len(images) + columns - 1) // columns) * height + 24), '#18212A')
    draw = ImageDraw.Draw(canvas)
    for index, (image, label) in enumerate(zip(resized, labels)):
        x, y = 24 + index % columns * (width + 24), 24 + index // columns * height
        draw.text((x, y), label, font=font, fill='#F6EFE2')
        canvas.paste(image, (x, y + 30))
    canvas.save(root / name)

# Crops only; no retouching, generated replacement content, or photo substitution.
home = Image.open(root / 'phone-home-final.png').crop((75, 1250, 1365, 2266))
panel([reference.crop((15, 341, 488, 690)), home], ['Provided Home mockup', 'Samsung: real saved Vision'], 'mockup-vs-phone-home.png')
details = Image.open(root / 'phone-details-final.png').crop((75, 1134, 1365, 2072))
panel([reference.crop((555, 350, 968, 711)), details], ['Provided Details mockup', 'Samsung: real saved Vision'], 'mockup-vs-phone-details.png')
names = [f'mockup-{variant}-{count}.png' for variant in ['home', 'details'] for count in [1, 3, 8]]
names += ['mockup-home-6-mixed-notes.png', 'mockup-details-6-mixed-notes.png']
panel([Image.open(root / name) for name in names], [name.removeprefix('mockup-').removesuffix('.png') for name in names], 'mockup-count-matrix.png', columns=4, width=260)
