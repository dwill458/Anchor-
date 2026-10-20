import pathlib, subprocess, hashlib, json, shutil, datetime
source=pathlib.Path(r'C:\Users\dwill\.codex\worktrees\expo58-upgrade\Anchor')
dest=pathlib.Path(r'E:\AnchorQA\expo58-stabilization-20261018\source')
evidence=pathlib.Path(r'E:\Projects\Anchor\docs\performance\expo58-stabilization-evidence-20261018')
def git(*args): return subprocess.check_output(['git','-C',str(source),*args])
paths=sorted(p for p in set(git('ls-files','-z','--cached','--others','--exclude-standard').decode().split('\0')) if p.startswith(('anchor/mobile/', 'scripts/', '.agents/')) or p in ('package.json','package-lock.json','.gitignore'))
paths=[p for p in paths if not p.startswith(('anchor/mobile/.', 'anchor/mobile/docs/', 'anchor/mobile/audio-remote/')) or p in ('anchor/mobile/.npmrc','anchor/mobile/.gitignore')]
paths.sort(key=lambda p: (0 if '/src/' in p else 1,p))
rows=[]
for rel in paths:
 p=source/rel
 if not p.is_file(): continue
 data=p.read_bytes(); sha=hashlib.sha256(data).hexdigest()
 target=dest/rel; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(data)
 rows.append({'path':rel,'sha256':sha,'bytes':len(data)})
drift=[r['path'] for r in rows if hashlib.sha256((source/r['path']).read_bytes()).hexdigest()!=r['sha256']]
manifest={'capturedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':str(source),'snapshot':str(dest),'head':git('rev-parse','HEAD').decode().strip(),'branch':git('branch','--show-current').decode().strip(),'status':git('status','--porcelain=v1').decode(),'driftDuringCapture':drift,'files':rows}
out=evidence/'source-manifest.json'; out.write_text(json.dumps(manifest,indent=2))
print(json.dumps({'files':len(rows),'bytes':sum(r['bytes'] for r in rows),'manifestSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'drift':drift,'snapshot':str(dest)}))


