"""Capture the real Moto Anchor surface at measured narration positions."""
import argparse
import json
from pathlib import Path
import subprocess
from urllib.parse import parse_qs, urlsplit

parser = argparse.ArgumentParser()
parser.add_argument('matrix')
parser.add_argument('alignment')
parser.add_argument('--output', required=True)
parser.add_argument('--suffix', required=True)
args = parser.parse_args()
rows = json.loads(Path(args.matrix).read_text(encoding='utf-8'))['matrix']
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
serial = 'ZY22KPQQHK'
current = None
targets = []
captured = set()
logcat = subprocess.Popen(['adb', '-s', serial, 'logcat', '-v', 'raw', '-s', 'ReactNativeJS:V', '*:S'], stdout=subprocess.PIPE, text=True, encoding='utf-8', errors='replace')
try:
    for line in logcat.stdout:
        if '[SESSION_AUDIO_' not in line:
            continue
        start, end = line.find('{'), line.rfind('}')
        if start < 0 or end <= start:
            continue
        try:
            event = json.loads(line[start:end + 1])
        except json.JSONDecodeError:
            continue
        if event.get('event') == 'received_url':
            run = parse_qs(urlsplit(event.get('url', '')).query).get('surface', [''])[0]
            matches = [row for row in rows if row['mode'] == 'visualize' and run.startswith(row['id'] + '-') and run.endswith(args.suffix)]
            current = run if matches else None
            targets = []
            if matches:
                row = matches[0]
                first_anchor = next(phrase for phrase in row['phrases'] if phrase['chapter'] == 'ANCHOR')
                alignment = json.loads((Path(args.alignment) / (row['id'] + '.json')).read_text(encoding='utf-8'))
                anchor_word = next(word for phrase in alignment['phrases'] for word in phrase['words'] if word['word'] == 'ANCHOR')
                targets = [('anchor-resolved', first_anchor['start'] + 3.25), ('anchor-named', anchor_word['start'] + .25)]
        if not current or not event.get('status'):
            continue
        position = event['status'].get('currentTime', 0)
        for label, at in targets:
            key = (current, label)
            if key in captured or position < at:
                continue
            path = output / (current + '-' + label + '.png')
            with path.open('wb') as stream:
                subprocess.run(['adb', '-s', serial, 'exec-out', 'screencap', '-p'], stdout=stream, check=True, timeout=15)
            captured.add(key)
            record = {'runId': current, 'label': label, 'targetSeconds': at, 'nativePositionSeconds': position, 'image': str(path)}
            with (output / 'visual-capture-evidence.jsonl').open('a', encoding='utf-8') as stream:
                stream.write(json.dumps(record) + '\n')
            print(json.dumps(record), flush=True)
finally:
    logcat.terminate()
