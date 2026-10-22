import os, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meta = json.load(open(os.path.join(ROOT,'src','meta.json')))
out = {}
JS = """(slug)=>{const svg=document.querySelector('#emb svg');const r=[];
for (const layer of ['plate','structure','emblem','engraving','highlight','accent']){
 const g=svg.querySelector('#'+slug+'__'+layer); if(!g) continue;
 const kids=[...g.querySelectorAll(':scope > *')];
 r.push({layer, id:g.id, children:kids.map(k=>{const o={id:k.id||null,tag:k.tagName.toLowerCase()};
   const hasFill=k.tagName==='g'||(k.getAttribute('fill')&&k.getAttribute('fill')!=='none');
   o.filled=!!hasFill; o.dashed=k.hasAttribute('stroke-dasharray');
   if(k.getTotalLength&&k.tagName!=='g'&&k.getAttribute('stroke')&&k.getAttribute('stroke')!=='none'){try{o.pathLength=+k.getTotalLength().toFixed(2)}catch(e){}}
   return o;})});}
return r;}"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); pg.goto('file://'+ROOT+'/preview/index.html'); pg.wait_for_timeout(300)
    for m in meta:
        pg.evaluate(f"__ui.select('{m['slug']}', false)")
        out[m['slug']] = {'family':m['family'],'viewBox':'0 0 256 256','layers':pg.evaluate(JS, m['slug'])}
    b.close()
json.dump(out, open(os.path.join(ROOT,'docs','animation-manifest.json'),'w'), indent=1)
print({k:sum(len(l['children']) for l in v['layers']) for k,v in out.items()})
