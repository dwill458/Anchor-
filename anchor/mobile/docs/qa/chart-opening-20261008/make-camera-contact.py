from PIL import Image, ImageDraw
from pathlib import Path
files=sorted(Path('docs/qa/chart-opening-20261008').glob('wrapper-camera-frame-*.png'))
W,H=196,426
out=Image.new('RGB',(W*4,H*((len(files)+3)//4)),'white')
for i,p in enumerate(files):
    im=Image.open(p).convert('RGB').resize((W,H))
    ImageDraw.Draw(im).text((4,4),f'{i*0.5:.1f}s',fill='red',stroke_width=2,stroke_fill='white')
    out.paste(im,((i%4)*W,(i//4)*H))
out.save('docs/qa/chart-opening-20261008/wrapper-camera-full-contact.png')
