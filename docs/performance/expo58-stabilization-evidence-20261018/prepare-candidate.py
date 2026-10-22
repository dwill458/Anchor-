import pathlib,json,shutil
root=pathlib.Path(r'E:\AnchorQA\expo58-stabilization-20261018')
m=json.loads(pathlib.Path(r'E:\Projects\Anchor\docs\performance\expo58-stabilization-evidence-20261018\source-manifest.json').read_text())
for row in m['files']:
 rel=row['path']
 if rel.startswith('anchor/mobile/assets/'): continue
 target=root/'candidate'/rel; target.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(root/'source'/rel,target)
print('Candidate source copied; assets and dependencies linked separately')
