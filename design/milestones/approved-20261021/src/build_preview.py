import os, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meta = json.load(open(os.path.join(ROOT,'src','meta.json')))
spec = json.load(open(os.path.join(ROOT,'docs','motion-spec.json')))
svgs = {m['slug']: {md: open(os.path.join(ROOT,'svg',md,m['slug']+'.svg')).read() for md in ('earned','locked')} for m in meta}
t = open(os.path.join(ROOT,'src','preview_template.html')).read()
t = t.replace('__SPEC__', json.dumps(spec)).replace('__SVGS__', json.dumps(svgs)).replace('__META__', json.dumps(meta))
open(os.path.join(ROOT,'preview','index.html'),'w').write(t)
print('preview', len(t)//1024, 'KB')
