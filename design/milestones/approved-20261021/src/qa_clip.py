import os, json, io
from playwright.sync_api import sync_playwright
from PIL import Image
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meta = json.load(open(os.path.join(ROOT,'src','meta.json')))
rep = {}
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':512,'height':512})
    for mode in ('earned','locked'):
        for m in meta:
            svg=open(os.path.join(ROOT,'svg',mode,m['slug']+'.svg')).read()
            pg.set_content(f'<body style="margin:0;background:transparent">{svg.replace("width=\"256\" height=\"256\"","width=\"512\" height=\"512\"")}</body>')
            pg.evaluate("document.querySelector('[id$=__plate]').remove()")
            png=pg.screenshot(omit_background=True, clip={'x':0,'y':0,'width':512,'height':512})
            a=np.array(Image.open(io.BytesIO(png)).convert('RGBA'))[:,:,3]
            ys,xs=np.nonzero(a>8); 
            r=np.sqrt((xs-256)**2+(ys-256)**2).max()/2
            rep[f'{mode}/{m["slug"]}']=round(float(r),1)
    b.close()
json.dump(rep,open(os.path.join(ROOT,'qa','clip_report.json'),'w'),indent=1)
worst=sorted(rep.items(), key=lambda kv:-kv[1])[:6]; print('max art radius (viewBox units; plate inner rim = 111, plate edge 120):'); print(worst)
print('all <=108:', all(v<=108 for v in rep.values()))
