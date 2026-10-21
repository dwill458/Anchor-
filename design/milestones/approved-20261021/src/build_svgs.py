import os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
from lib import render_svg
import emblems
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meta = []
FIXED = set()
SCALE = {'strength_building':1.2,'strength_established':1.14,'strength_integrated':1.1,'strength_reinforced':1.05,'vision_seen_clearly':1.12,'commitment_ten_practices':1.0}
import json as _j
RAW = _j.load(open(os.path.join(ROOT,'src','raw_radius.json'))) if os.path.exists(os.path.join(ROOT,'src','raw_radius.json')) else {}
FIT = 94.0   # art must sit inside the inner plate ring (r=101) with margin
for fn in emblems.ALL:
    e = fn()
    old = 1 if os.environ.get('NOSCALE') else SCALE.get(e['slug'], 1)
    R = RAW.get(e['slug'])
    e['scale'] = round(min(1.25, FIT/R), 3) if (R and R*old > FIT) else old
    for mode in ("earned", "locked"):
        p = os.path.join(ROOT, "svg", mode, f"{e['slug']}.svg")
        open(p, "w").write(render_svg(e, mode))
    meta.append({k: e[k] for k in ("slug", "name", "category", "req", "family", "note")}|{"scale": e["scale"]})
json.dump(meta, open(os.path.join(ROOT, "src", "meta.json"), "w"), indent=1)
print(len(meta), "emblems written")
