import os, json, sys
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meta = json.load(open(os.path.join(ROOT,'src','meta.json')))
os.makedirs(os.path.join(ROOT,'qa','frames'),exist_ok=True)
only = sys.argv[1].split(',') if len(sys.argv)>1 else None
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':1300,'height':900})
    errs=[]; pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://'+ROOT+'/preview/index.html'); pg.wait_for_timeout(500)
    for m in meta:
        if only and m['slug'] not in only: continue
        s=m['slug']
        pg.evaluate(f"__ui.select('{s}', false)")
        emb = pg.locator('#emb')
        pg.evaluate("document.getElementById('speed').value='1'")
        pg.evaluate("__ui.play()")
        dur = pg.evaluate("__ui.duration()")
        # sample frames
        fr=[]
        for i,t in enumerate((0.12,0.3,0.5,0.7,0.88)):
            pg.wait_for_timeout(1) 
            pg.evaluate("(t)=>{const sc=document.getElementById('scrub');}", t)
        pg.wait_for_function("__ui.state()==='done'", timeout=15000)
        held = os.path.join(ROOT,'qa','frames',f'{s}_held.png'); emb.screenshot(path=held)
        pg.evaluate("__ui.cancelAnimations()")
        static = os.path.join(ROOT,'qa','frames',f'{s}_static.png'); emb.screenshot(path=static)
        a=Image.open(held).convert('RGB'); c=Image.open(static).convert('RGB')
        diff = ImageChops.difference(a,c); bbox = diff.getbbox()
        mx = max(diff.getextrema()[i][1] for i in range(3))
        res[s]={'duration_ms':dur,'max_pixel_diff_held_vs_static':mx,'bbox':bbox}
    b.close()
print(json.dumps(res,indent=1)); print('console errors:',errs[:5])
json.dump(res,open(os.path.join(ROOT,'qa','settle_report.json'),'w'),indent=1)
