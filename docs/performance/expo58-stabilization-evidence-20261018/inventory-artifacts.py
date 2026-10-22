import subprocess,pathlib,zipfile,json,re
adbexe=r'C:\Users\dwill\AppData\Local\Android\Sdk\build-tools\37.0.0\aapt.exe'
paths=subprocess.check_output(['rg','--files',r'E:\apd','-g','*.apk'],text=True).splitlines()
paths += [r'C:\Users\dwill\.codex\worktrees\expo58-upgrade\Anchor\anchor\mobile\android\app\build\outputs\apk\release\app-release.apk']
rows=[]
for p in sorted(set(paths)):
 try:
  with zipfile.ZipFile(p) as z:
   names=z.namelist(); abis=sorted({n.split('/')[1] for n in names if n.startswith('lib/') and n.endswith('.so')})
   sdk=None
   if 'assets/app.config' in names:
    config=json.loads(z.read('assets/app.config')); sdk=config.get('sdkVersion') or config.get('expo',{}).get('sdkVersion')
   package=subprocess.run([adbexe,'dump','badging',p],capture_output=True,text=True).stdout
   match=re.search(r"package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'",package)
   rows.append({'path':p,'abis':abis,'sdkVersionFromEmbeddedConfig':sdk,'package':match.group(1) if match else None,'versionCode':match.group(2) if match else None,'debuggable':'application-debuggable' in package})
 except Exception as e: rows.append({'path':p,'error':type(e).__name__})
base=pathlib.Path(r'E:\Projects\Anchor\docs\performance\expo58-stabilization-evidence-20261018')
(base/'artifact-inventory.json').write_text(json.dumps(rows,indent=2))
print(json.dumps({'artifacts':len(rows),'embeddedSdkVersions':sorted({str(r.get('sdkVersionFromEmbeddedConfig')) for r in rows}),'expo58PackageRows':[r for r in rows if 'expo58' in str(r.get('package'))]}))
