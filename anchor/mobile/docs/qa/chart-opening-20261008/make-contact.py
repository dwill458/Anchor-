from PIL import Image, ImageDraw
from pathlib import Path
files=sorted(Path('docs/qa/chart-opening-20261008').glob('wrapper-full-frame-*.png'))
thumbs=[]
W,H=196,426
for i,p in enumerate(files):
    im=Image.open(p).convert('RGB').resize((W,H))
    d=ImageDraw.Draw(im)
    d.rectangle((0,0,80,24),fill='white')
    d.text((4,4),f'{i*0.5:.1f}s',fill='black')
    thumbs.append(im)
out=Image.new('RGB',(W*4,H*((len(thumbs)+3)//4)),'white')
for i,im in enumerate(thumbs):
    out.paste(im,((i%4)*W,(i//4)*H))
out.save('docs/qa/chart-opening-20261008/wrapper-full-contact.png')
