from PIL import Image
from pathlib import Path
import json
root=Path('docs/qa/chart-opening-20261008')
a=Image.open(root/'intro-before.png').convert('RGB')
b=Image.open(root/'finalsource-full-final.png').convert('RGB')
if a.size != b.size: raise SystemExit(f'size mismatch {a.size} != {b.size}')
w,h=a.size
pa=a.load(); pb=b.load(); total=0; changed=0; maxdiff=0; count=0
for y in range(h):
    if y < 64 or 937 <= y < 1329 or y >= h-54: continue
    for x in range(w):
        diffs=[abs(pa[x,y][c]-pb[x,y][c]) for c in range(3)]
        total += sum(diffs); maxdiff=max(maxdiff,*diffs); count += 3
        if max(diffs)>12: changed += 1
out={'baseline':'intro-before.png','current':'finalsource-full-final.png','size':[w,h],'maskedYZones':[[0,64],[937,1329],[h-54,h]],'comparedPixels':(h-64-(1329-937)-54)*w,'changedPixelsAnyChannelOver12':changed,'mae':round(total/count,6),'maxChannelDelta':maxdiff}
(root/'final-source-masked-diff.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))
