import subprocess,json,pathlib
adb=r'C:\Users\dwill\AppData\Local\Android\Sdk\platform-tools\adb.exe'
r=subprocess.run([adb,'-s','R5CX12KBNGR','exec-out','run-as','com.anchorintentions.sqlcipherpreview20261015','head','-c','16','files/SQLite/anchor-private-v1.db'],capture_output=True)
out={'operation':'read-only database header comparison','exitCode':r.returncode,'bytesRead':len(r.stdout),'plaintextSqliteHeader':r.stdout==b'SQLite format 3\0'}
pathlib.Path(r'E:\Projects\Anchor\docs\performance\expo58-stabilization-evidence-20261018\database-header-check.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
