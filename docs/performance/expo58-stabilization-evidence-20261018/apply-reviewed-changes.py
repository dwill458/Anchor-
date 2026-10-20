import pathlib,json,hashlib,subprocess
base=pathlib.Path(r'E:\AnchorQA\expo58-stabilization-20261018')
evidence=pathlib.Path(r'E:\Projects\Anchor\docs\performance\expo58-stabilization-evidence-20261018')
manifest=json.loads((evidence/'source-manifest.json').read_text()); changes=json.loads((evidence/'candidate-changes.json').read_text()); original=pathlib.Path(manifest['source'])
head=subprocess.check_output(['git','-C',str(original),'rev-parse','HEAD'],text=True).strip()
if head != manifest['head']: raise SystemExit('Source HEAD changed; no files applied')
conflicts=[]
for row in changes:
 target=original/row['path']; actual=hashlib.sha256(target.read_bytes()).hexdigest() if target.is_file() else None
 if actual != row['baselineSha256']: conflicts.append(row['path'])
 candidate=base/'candidate'/row['path']
 if hashlib.sha256(candidate.read_bytes()).hexdigest()!=row['sha256']: conflicts.append('candidate drift: '+row['path'])
if conflicts: raise SystemExit('Conflicts; no files applied: '+repr(conflicts))
for row in changes:
 target=original/row['path']; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes((base/'candidate'/row['path']).read_bytes())
(evidence/'applied-changes.json').write_text(json.dumps({'head':head,'source':str(original),'files':changes},indent=2))
print('Applied '+str(len(changes))+' reviewed files; original preexisting contents matched frozen baseline')
