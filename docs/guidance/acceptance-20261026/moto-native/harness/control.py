from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
import json,time
root=Path(__file__).parent
config={'id':1,'mode':'home','focus':True,'milestone':False,'scene':False,'y':240,'width':0,'reduced':False,'value':None}
events=[]
class H(BaseHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_GET(self):
  data=json.dumps(events if self.path=='/events' else config).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(data)
 def do_POST(self):
  data=json.loads(self.rfile.read(int(self.headers.get('Content-Length',0))) or b'{}')
  if self.path=='/config':config.update(data)
  else:
   data['time']=time.time();events.append(data)
   with (root/'evidence/events.jsonl').open('a') as f:f.write(json.dumps(data)+'\n')
  self.send_response(200);self.end_headers();self.wfile.write(b'OK')
ThreadingHTTPServer(('127.0.0.1',8094),H).serve_forever()
