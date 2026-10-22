import json,pathlib,hashlib
base=pathlib.Path(r'E:\Projects\Anchor\docs\performance\expo58-stabilization-evidence-20261018')
m=json.loads((base/'source-manifest.json').read_text()); source=pathlib.Path(m['source'])
changed=[]
for row in m['files']:
 p=source/row['path']
 if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=row['sha256']: changed.append(row['path'])
(base/'source-drift-check.json').write_text(json.dumps({'changedSinceCapture':changed},indent=2))
print(json.dumps({'changedSinceCapture':changed}))
