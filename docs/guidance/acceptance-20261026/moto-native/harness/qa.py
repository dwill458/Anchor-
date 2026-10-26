import urllib.request,json,subprocess,time
from pathlib import Path
ROOT=Path(__file__).parent; E=ROOT/'evidence'; SERIAL='192.168.0.247:40897'
def get(path='/events'):return json.load(urllib.request.urlopen('http://127.0.0.1:8094'+path))
def config(**data):
 urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8094/config',json.dumps(data).encode(),{'Content-Type':'application/json'})).read()
def adb(*args):return subprocess.check_output(['adb','-s',SERIAL,*map(str,args)])
def tap(x,y):adb('shell','input','tap',round(x),round(y));time.sleep(.3)
def shot(name): (E/(name+'.png')).write_bytes(adb('exec-out','screencap','-p'))
def run(i,mode='home',**kw):
 data=dict(id=i,mode=mode,focus=True,milestone=False,scene=False,y=240,width=0,reduced=False,value=None);data.update(kw);config(**data);time.sleep(1.3)
def events(i):return [e for e in get() if e.get('id')==i]
def summary(name,data):
 with (E/'checks.jsonl').open('a') as f:f.write(json.dumps({'check':name,**data})+'\n')
 print(name,json.dumps(data))
