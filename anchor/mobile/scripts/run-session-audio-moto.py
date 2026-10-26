"""Play every real session component on the USB Moto and record its digital audio output."""
import argparse
import json
import os
from pathlib import Path
import queue
import subprocess
import threading
import time
import re
import xml.etree.ElementTree as ET
from urllib.parse import parse_qs, urlsplit

parser = argparse.ArgumentParser()
parser.add_argument('matrix')
parser.add_argument('--scrcpy', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--filter', default='')
parser.add_argument('--suffix', default='verified')
parser.add_argument('--capture-source', choices=['output', 'playback'], default='output')
args = parser.parse_args()
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
serial = 'ZY22KPQQHK'
rows = [row for row in json.loads(Path(args.matrix).read_text(encoding='utf-8'))['matrix'] if args.filter in row['id']]
messages = queue.Queue()
log_file = (output / ('native-logcat-' + args.suffix + '.txt')).open('w', encoding='utf-8')
logcat = subprocess.Popen(['adb', '-s', serial, 'logcat', '-v', 'raw', '-s', 'ReactNativeJS:V', '*:S'],
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace', creationflags=subprocess.CREATE_NO_WINDOW)
def collect():
    current_run = None
    for line in logcat.stdout:
        log_file.write(line)
        log_file.flush()
        if '[SESSION_AUDIO_' in line:
            start, end = line.find('{'), line.rfind('}')
            if start >= 0 and end > start:
                try:
                    event = json.loads(line[start:end + 1])
                    if '[SESSION_AUDIO_QA]' in line:
                        if event.get('event') == 'received_url':
                            current_run = parse_qs(urlsplit(event.get('url', '')).query).get('surface', [None])[0]
                        messages.put(event)
                    elif '[SESSION_AUDIO_NATIVE]' in line and current_run and current_run.startswith('audio-visualize-') and event.get('status'):
                        messages.put({'event': 'audio_position', 'runId': current_run, 'seconds': event['status']['currentTime']})
                except json.JSONDecodeError:
                    pass
threading.Thread(target=collect, daemon=True).start()
results = output / ('native-results-' + args.suffix + '.jsonl')
def screenshot(file):
    with file.open('wb') as image:
        subprocess.run(['adb', '-s', serial, 'exec-out', 'screencap', '-p'], stdout=image, stderr=subprocess.DEVNULL, timeout=15, check=True)

def recorder_servers():
    result = subprocess.run(['adb', '-s', serial, 'shell', 'ps', '-A', '-o', 'PID,NAME,ARGS'], capture_output=True, text=True, timeout=10, check=True)
    return {line.split()[0] for line in result.stdout.splitlines() if 'com.genymobile.scrcpy.Server' in line and line.split()[1] == 'app_process'}
try:
    for index, row in enumerate(rows):
        run_id = row['id'] + '-' + args.suffix
        recording = output / (run_id + '.flac')
        scrcpy_log = (output / (run_id + '-scrcpy.txt')).open('w', encoding='utf-8')
        seconds = row.get('playbackDuration', row['duration'])
        previous_servers = recorder_servers()
        capture_args = [args.scrcpy, '--serial', serial, '--no-video', '--no-control', '--no-playback', '--no-window',
                        '--audio-source=' + args.capture_source, '--audio-codec=flac', '--record=' + str(recording), '--time-limit=' + str(int(seconds) + 150)]
        if args.capture_source == 'playback':
            capture_args.append('--audio-dup')
        recorder = subprocess.Popen(capture_args,
                                    stdout=scrcpy_log, stderr=subprocess.STDOUT, env=os.environ.copy(), creationflags=subprocess.CREATE_NO_WINDOW)
        ready_until = time.monotonic() + 15
        while time.monotonic() < ready_until:
            if 'Recording started' in Path(scrcpy_log.name).read_text(encoding='utf-8', errors='replace'):
                break
            if recorder.poll() is not None:
                raise RuntimeError('Audio recorder failed: ' + Path(scrcpy_log.name).read_text(encoding='utf-8', errors='replace'))
            time.sleep(.2)
        else:
            raise RuntimeError('Recorder did not become ready')
        owned_servers = recorder_servers() - previous_servers
        if len(owned_servers) != 1:
            raise RuntimeError('Cannot identify this capture server safely: ' + str(owned_servers))
        print(json.dumps({'event': 'case_started', 'index': index + 1, 'total': len(rows), 'id': run_id, 'seconds': seconds}), flush=True)
        subprocess.run(['adb', '-s', serial, 'shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW',
                        '-d', 'anchor://vision-visual-qa?surface=' + run_id, '-p', 'com.anchorintentions.app'],
                       capture_output=True, text=True, timeout=20, check=True)
        # Android intent delivery may briefly background the previous Activity. Deep Focus correctly
        # starts paused in that state; resume through the production button after the app is foreground.
        if row['mode'] == 'deep_prime':
            time.sleep(.7)
            subprocess.run(['adb', '-s', serial, 'shell', 'uiautomator', 'dump', '/sdcard/anchor-audio-qa.xml'], capture_output=True, timeout=12)
            xml = subprocess.run(['adb', '-s', serial, 'shell', 'cat', '/sdcard/anchor-audio-qa.xml'], capture_output=True, text=True, timeout=10).stdout
            try:
                for node in ET.fromstring(xml).iter('node'):
                    if node.attrib.get('text', '').upper() != 'RESUME' and not node.attrib.get('content-desc', '').startswith('Resume'):
                        continue
                    bounds = list(map(int, re.findall(r'\d+', node.attrib['bounds'])))
                    subprocess.run(['adb', '-s', serial, 'shell', 'input', 'tap', str((bounds[0] + bounds[2]) // 2), str((bounds[1] + bounds[3]) // 2)], check=True, timeout=10)
                    print(json.dumps({'event': 'resumed_initial_pause', 'id': run_id}), flush=True)
                    break
            except ET.ParseError:
                raise RuntimeError('Unable to inspect initial Deep Focus state')
        events = []
        deadline = time.monotonic() + seconds + 120
        started = time.monotonic()
        captures = [('start', 3)]
        if row['mode'] == 'visualize':
            anchor = next(phrase for phrase in row['phrases'] if phrase['chapter'] == 'ANCHOR')
            captures.append(('anchor-caption', anchor['start'] + 1))
        done = False
        native_position = 0
        while time.monotonic() < deadline:
            for label, at in list(captures):
                clock = native_position if row['mode'] == 'visualize' else time.monotonic() - started
                if clock >= at:
                    screenshot(output / (run_id + '-' + label + '.png'))
                    captures.remove((label, at))
            try:
                message = messages.get(timeout=.2)
            except queue.Empty:
                continue
            if message.get('runId') != run_id:
                continue
            if message.get('event') == 'audio_position':
                native_position = message['seconds']
                continue
            events.append(message)
            if message.get('event') in ('preparation_failed', 'exited'):
                break
            if message.get('event') == 'completed':
                done = True
                break
        screenshot(output / (run_id + '-end.png'))
        # Keep the completion cue, then disconnect only this recorder's server.
        # A fixed recording limit would lose the end of a session that buffered.
        time.sleep(3)
        for pid in owned_servers & recorder_servers():
            subprocess.run(['adb', '-s', serial, 'shell', 'kill', '-TERM', pid], capture_output=True, timeout=10, check=True)
        recorder.wait(timeout=40)
        scrcpy_log.close()
        result = {'id': run_id, 'completed': done, 'events': events, 'recording': str(recording), 'recorderExit': recorder.returncode,
                  'recordingBytes': recording.stat().st_size if recording.exists() else 0}
        with results.open('a', encoding='utf-8') as stream:
            stream.write(json.dumps(result) + '\n')
        (output / 'native-progress.json').write_text(json.dumps({'index': index + 1, 'total': len(rows), 'last': result}, indent=2), encoding='utf-8')
        print(json.dumps({'event': 'case_finished', 'index': index + 1, 'total': len(rows), 'id': run_id, 'completed': done,
                          'elapsedMs': events[-1].get('elapsedMs') if events else None, 'bytes': result['recordingBytes']}), flush=True)
        if not done:
            raise RuntimeError('Session did not complete; evidence preserved for ' + run_id)
finally:
    logcat.terminate()
    log_file.close()
