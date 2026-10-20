import subprocess,json,pathlib
adb=r'C:\Users\dwill\AppData\Local\Android\Sdk\platform-tools\adb.exe'
r=subprocess.run([adb,'-s','R5CX12KBNGR','exec-out','run-as','com.anchorintentions.sqlcipherpreview20261015','--user','10','head','-c','16','files/SQLite/anchor-private-v1.db'],capture_output=True)
result={'profile':10,'exitCode':r.returncode,'bytesRead':len(r.stdout),'plaintextSqliteHeader':r.stdout==b'SQLite format 3\0'}
pathlib.Path(r'E:\Projects\Anchor\docs\performance\expo58-stabilization-evidence-20261018\profile10-database-header.json').write_text(json.dumps(result,indent=2)); print(json.dumps(result))
