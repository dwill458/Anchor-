import pathlib,json,shutil
base=pathlib.Path(r'E:\AnchorQA\expo58-stabilization-20261018'); evidence=pathlib.Path(r'E:\Projects\Anchor\docs\performance\expo58-stabilization-evidence-20261018')
manifest=json.loads((evidence/'source-manifest.json').read_text())
paths={r['path'] for r in manifest['files']}|{r['path'] for r in json.loads((evidence/'candidate-changes.json').read_text())}
for rel in paths:
 if rel.startswith('anchor/mobile/assets/'): continue
 src=base/'candidate'/rel
 if not src.is_file(): continue
 dst=base/'sandbox'/rel; dst.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(src,dst)
for rel in ['.env.local','google-services.json','GoogleService-Info.plist']:
 src=base/'candidate'/'anchor/mobile'/rel
 if src.is_file(): shutil.copy2(src,base/'sandbox'/'anchor/mobile'/rel)
print('Copied frozen candidate into profile-only runtime sandbox')
