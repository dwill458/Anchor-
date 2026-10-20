import json,pathlib,hashlib,datetime,subprocess
p=pathlib.Path(r'E:\Projects\Anchor\docs\performance\expo58-stabilization-evidence-20261018');manifest=json.loads((p/'source-manifest.json').read_text());expected={x['path']:x['sha256'] for x in manifest['files']};expected.update({x['path']:x['sha256'] for x in json.loads((p/'candidate-changes.json').read_text())})
roots={'candidate':pathlib.Path(r'E:\AnchorQA\expo58-stabilization-20261018\candidate'),'upgrade':pathlib.Path(r'C:\Users\dwill\.codex\worktrees\expo58-upgrade\Anchor')};result={}
for name,root in roots.items():
 drift=[]
 for rel,sha in expected.items():
  f=root/rel
  if not f.is_file() or hashlib.sha256(f.read_bytes()).hexdigest()!=sha:drift.append(rel)
 result[name]={'checkedFiles':len(expected),'differingFromExpected':drift}
result['knownGeneratedSnapshotHeaderOnly']='anchor/mobile/src/components/v2/chart/map/__tests__/__snapshots__/chartCloudTiles.test.ts.snap'
result['head']=subprocess.check_output(['git','-C',str(roots['upgrade']),'rev-parse','HEAD'],text=True).strip();result['utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();(p/'final-source-attestation.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
