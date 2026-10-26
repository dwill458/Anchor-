"""Check committed caption text and audio positions from the real native session renderer."""
import argparse
import json
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

parser = argparse.ArgumentParser()
parser.add_argument('matrix')
parser.add_argument('log')
parser.add_argument('--output', required=True)
args = parser.parse_args()
rows = [row for row in json.loads(Path(args.matrix).read_text(encoding='utf-8'))['matrix'] if row['mode'] == 'visualize']
observed = {}
run = None
for line in Path(args.log).read_text(encoding='utf-8', errors='replace').splitlines():
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
        run = parse_qs(urlsplit(event.get('url', '')).query).get('surface', [None])[0]
    if '[SESSION_AUDIO_CAPTION]' in line and run:
        observed.setdefault(run, []).append(event)
evidence = []
for run, captions in observed.items():
    row = next((row for row in rows if run.startswith(row['id'] + '-')), None)
    if row is None:
        continue
    missing, timing, matched = [], [], []
    for expected in row['captions']:
        matches = [item for item in captions if item['phraseId'] == expected['phraseId'] and item['text'] == expected['text']]
        if not matches:
            missing.append(expected)
            continue
        actual = matches[0]
        delay = actual['positionMs'] - expected['startMs']
        matched.append({'phraseId': actual['phraseId'], 'text': actual['text'], 'expectedStartMs': expected['startMs'], 'renderedAtMs': actual['positionMs'], 'delayMs': delay})
        if delay < 0 or delay > 350 or actual['positionMs'] > expected['endMs']:
            timing.append(matched[-1])
    item = {'id': run, 'expectedCaptions': len(row['captions']), 'observedCaptions': len(captions), 'matchedCaptions': len(matched),
            'expectedPhrases': len(row['phrases']), 'observedPhrases': len(set(item['phraseId'] for item in captions)),
            'maximumPublishDelayMs': max((item['delayMs'] for item in matched), default=None), 'missing': missing, 'timingIssues': timing, 'captions': matched}
    evidence.append(item)
    print(json.dumps({key: value for key, value in item.items() if key not in ['captions', 'missing', 'timingIssues']} | {'missingCount': len(missing), 'timingIssueCount': len(timing)}))
Path(args.output).write_text(json.dumps(evidence, indent=2), encoding='utf-8')
