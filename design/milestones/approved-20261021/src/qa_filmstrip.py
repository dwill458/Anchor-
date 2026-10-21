import os, json, sys
from playwright.sync_api import sync_playwright
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meta = json.load(open(os.path.join(ROOT,'src','meta.json')))
os.makedirs(os.path.join(ROOT,'qa','strips'),exist_ok=True)
only = sys.argv[1].split(',') if len(sys.argv)>1 else None
stops=[0.08,0.2,0.35,0.5,0.65,0.8,1.0]
outs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1300,'height':900})
    pg.goto('file://'+ROOT+'/preview/index.html'); pg.wait_for_timeout(400)
    for m in meta:
        if only and m['slug'] not in only: continue
        s=m['slug']; pg.evaluate(f"__ui.select('{s}', false)")
        frames=[]
        for t in stops:
            pg.evaluate("""(v)=>{const e=document.getElementById('scrub'); e.value=Math.round(v*1000); e.dispatchEvent(new Event('input'));}""", t)
            pg.wait_for_timeout(60)
            fp=os.path.join(ROOT,'qa','strips',f'{s}_{int(t*100)}.png'); pg.locator('#emb').screenshot(path=fp); frames.append(Image.open(fp).convert('RGB').resize((200,200)))
        W=Image.new('RGB',(200*len(frames),200),(20,22,43))
        for i,f in enumerate(frames): W.paste(f,(200*i,0))
        o=os.path.join(ROOT,'qa','strips',f'{s}_strip.png'); W.save(o); outs.append(o)
    b.close()
# combined
ims=[Image.open(o) for o in outs]
H=Image.new('RGB',(ims[0].width,sum(i.height for i in ims)),(20,22,43)); y=0
for i in ims: H.paste(i,(0,y)); y+=i.height
H.save(os.path.join(ROOT,'qa','strips','_all.png' if not only else '_sel.png')); print(len(outs))
