import pathlib,json,hashlib
root=pathlib.Path(r'E:\AnchorQA\expo58-stabilization-20261018'); evidence=pathlib.Path(r'E:\Projects\Anchor\docs\performance\expo58-stabilization-evidence-20261018')
m=json.loads((evidence/'source-manifest.json').read_text()); original={r['path']:r for r in m['files']}
changes=[]
for p in (root/'candidate'/'anchor'/'mobile'/'src').rglob('*'):
 if not p.is_file(): continue
 rel=p.relative_to(root/'candidate').as_posix(); sha=hashlib.sha256(p.read_bytes()).hexdigest()
 if rel not in original or sha!=original[rel]['sha256']: changes.append({'path':rel,'sha256':sha,'baselineSha256':original.get(rel,{}).get('sha256')})
(evidence/'candidate-changes.json').write_text(json.dumps(changes,indent=2)); print('\n'.join(r['path'] for r in changes))
