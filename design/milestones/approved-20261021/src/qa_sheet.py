import sys, os, json, asyncio
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meta = json.load(open(os.path.join(ROOT,'src','meta.json')))
mode = sys.argv[1] if len(sys.argv)>1 else 'earned'
size = int(sys.argv[2]) if len(sys.argv)>2 else 230
only = sys.argv[3].split(',') if len(sys.argv)>3 else None
items = [m for m in meta if not only or m['slug'] in only]
cells = ''.join(f'<div class=c><img src="file://{ROOT}/svg/{mode}/{m["slug"]}.svg" width={size} height={size}><span>{m["name"]}</span></div>' for m in items)
tiles = ''.join(f'<img src="file://{ROOT}/svg/{mode}/{m["slug"]}.svg" width=64 height=64>' for m in items)
html = f'''<body style="margin:0;background:#FAF6EE;font:12px sans-serif;padding:16px;width:{(size+16)*4+32}px">
<div style="display:grid;grid-template-columns:repeat(4,{size}px);gap:16px">{cells}</div>
<div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">{tiles}</div></body><style>.c{{text-align:center}}</style>'''
open('/tmp/qa.html','w').write(html)
out = os.path.join(ROOT,'qa',f'sheet_{mode}_{"sample" if only else "all"}.png')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':(size+16)*4+64,'height':800}, device_scale_factor=2)
    pg.goto('file:///tmp/qa.html'); pg.wait_for_timeout(300)
    pg.screenshot(path=out, full_page=True); b.close()
print(out)
