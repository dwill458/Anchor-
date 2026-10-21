import os, json, base64, urllib.parse
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meta = {m['slug']: m for m in json.load(open(os.path.join(ROOT,'src','meta.json')))}
def svg_uri(mode, slug): return 'data:image/svg+xml;charset=utf-8,'+urllib.parse.quote(open(os.path.join(ROOT,'svg',mode,slug+'.svg')).read())
def png_uri(slug): return 'data:image/png;base64,'+base64.b64encode(open(os.path.join(ROOT,'contact-sheet','originals',slug+'.png'),'rb').read()).decode()
# order = mockup order (threshold progression)
ORDER = {
 'Strength':[('strength_building',0),('strength_established',0),('strength_integrated',0),('strength_reinforced',0),('strength_full_strength',0)],
 'Commitment':[('commitment_first_practice',1),('commitment_ten_practices',0),('commitment_thirty_practices',0),('commitment_one_hundred_practices',0),('commitment_100_minutes',0),('commitment_500_minutes',0)],
 'Journey':[('journey_first_waypoint',0),('journey_halfway',0),('journey_all_waypoints',0),('journey_goal_reached',1)],
 'Vision':[('vision_first_glimpse',1),('vision_picture_complete',0),('vision_seen_clearly',0),('vision_familiar_future',0),('vision_living_the_vision',0)],
}
ORIG = {'commitment_first_practice':('First Practice','1 practice'),
        'journey_goal_reached':('Goal Reached','Final waypoint'),'vision_first_glimpse':('First Glimpse','Create a Vision')}
sub = {'Strength':'Building your Anchor’s Thread Strength','Commitment':'Showing up for what matters','Journey':'Making progress on your Chart','Vision':'Bringing your future into focus'}
def card(slug, orig):
    if False:
        n,r = ORIG[slug]; u = png_uri(slug)
        return f'''<div class="card orig"><div class="pair"><div class="d lk"><img class="rast lkf" src="{u}"></div><div class="d"><img class="rast" src="{u}"></div></div>
        <div class="nm">{n}</div><div class="rq">{r}</div><div class="tag">reference crop · SVG master missing</div></div>'''
    m = meta[slug]
    return f'''<div class="card"><div class="pair"><div class="d"><img src="{svg_uri('locked',slug)}"></div><div class="d"><img src="{svg_uri('earned',slug)}"></div></div>
    <div class="nm">{m['name']}</div><div class="rq">{m['req']}</div></div>'''
secs=''
n=0
for cat,items in ORDER.items():
    cards=''.join(card(s,o) for s,o in items); n+=len(items)
    secs+=f'<section><h2>{cat.upper()} <em>({len(items)})</em></h2><p>{sub[cat]}</p><div class="row">{cards}</div></section>'
html=f'''<!doctype html><html><head><meta charset="utf-8"><title>Anchor Milestone Collection — 20</title><style>
body{{margin:0;background:#F6F0E4;color:#13222C;font-family:"Iowan Old Style","Palatino Linotype",Georgia,serif;padding:36px 44px;width:1700px}}
header{{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(143,111,34,.4);padding-bottom:12px;margin-bottom:8px}}
h1{{margin:0;font-size:26px;font-weight:500;letter-spacing:.02em}}header span{{font:12px/1.4 system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#8F6F22}}
section{{margin-top:26px}}h2{{margin:0;font:600 13px system-ui,sans-serif;letter-spacing:.24em;color:#13222C}}h2 em{{font-style:normal;color:#8F6F22}}
section p{{margin:2px 0 12px;font:13px system-ui,sans-serif;color:#6b6a78}}
.row{{display:flex;gap:16px}}.card{{flex:0 0 255px;text-align:center}}
.pair{{display:flex;gap:6px;justify-content:center}}.d{{width:124px;height:124px;display:flex;align-items:center;justify-content:center;border-radius:50%;overflow:hidden}}.d img{{width:124px;height:124px;display:block}}
.d img.rast{{width:124px;height:124px;object-fit:cover}}
.lkf{{filter:grayscale(1) contrast(.55) brightness(1.18) opacity(.8)}}
.nm{{margin-top:8px;font-size:18px;font-weight:500}}.rq{{font:12px system-ui,sans-serif;color:#6b6a78}}
.tag{{margin-top:3px;font:10px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#a0632a}}
.cap{{display:flex;gap:6px;justify-content:center;font:10px system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#8F6F22}}
footer{{margin-top:26px;font:12px/1.5 system-ui,sans-serif;color:#6b6a78;border-top:1px solid rgba(143,111,34,.3);padding-top:10px}}
.leg{{display:flex;gap:6px;justify-content:flex-end;font:11px system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#8F6F22}}
</style></head><body>
<header><h1>Anchor 2.0 — Milestone Collection</h1><span>20 milestones · each card: locked ◂ ▸ earned</span></header>
{secs}
<footer>All 20 are vector masters (256 × 256) on one shared plate. Full Strength is a vector candidate for 100 Strength; First Practice, Goal Reached and First Glimpse are vector reconstructions from in-app screenshots (not your original SVG masters). Design slugs are provisional.</footer>
</body></html>'''
out=os.path.join(ROOT,'contact-sheet','contact-sheet.html'); open(out,'w').write(html)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1790,'height':900},device_scale_factor=2)
    pg.goto('file://'+out); pg.wait_for_timeout(500); pg.screenshot(path=os.path.join(ROOT,'contact-sheet','contact-sheet.png'),full_page=True); b.close()
print('ok',n)
