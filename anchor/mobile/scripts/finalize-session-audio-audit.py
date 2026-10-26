"""Generate a fail-closed acceptance matrix from completed native evidence."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('matrix')
parser.add_argument('--results', nargs='+', required=True)
parser.add_argument('--comparisons', nargs='+', required=True)
parser.add_argument('--native', nargs='+', required=True)
parser.add_argument('--captions', required=True)
parser.add_argument('--controls', required=True)
parser.add_argument('--recordings', required=True, help='Durable directory containing the accepted FLAC files.')
parser.add_argument('--output', required=True)
args = parser.parse_args()
inventory = json.loads(Path(args.matrix).read_text(encoding='utf-8'))
results = [json.loads(line) for file in args.results for line in Path(file).read_text(encoding='utf-8').splitlines() if line.strip()]
comparisons = {item['id']: item for file in args.comparisons for item in json.loads(Path(file).read_text(encoding='utf-8'))}
captions = {item['id']: item for item in json.loads(Path(args.captions).read_text(encoding='utf-8'))}
players = [item for file in args.native for item in json.loads(Path(file).read_text(encoding='utf-8'))]
controls = json.loads(Path(args.controls).read_text(encoding='utf-8'))
if len(results) != len(inventory['matrix']) or len(inventory['matrix']) != 30:
    raise ValueError('The acceptance matrix must contain exactly 30 native results')
required_controls = {'Focus native source failure/retry', 'Deep Focus mute/pause/resume',
                     'Visualize background/resume', 'Focus modular cue progression while muted'}
if not required_controls.issubset({item['case'] for item in controls if item['passed']}):
    raise ValueError('Native control checks are incomplete')
if any(asset.get('missing') or not asset.get('decodeOk') for asset in inventory['assets']):
    raise ValueError('A source asset failed its decode check')
evidence = []
for row in inventory['matrix']:
    matching = [item for item in results if item['id'].startswith(row['id'] + '-')]
    if len(matching) != 1:
        raise ValueError('Missing or duplicate native result: ' + row['id'])
    result = matching[0]
    if not result['completed'] or sum(event.get('event') == 'completed' for event in result['events']) != 1:
        raise ValueError('Session did not complete exactly once: ' + result['id'])
    comparison = comparisons[result['id']]
    for cue in comparison['cues']:
        if 'error' in cue:
            raise ValueError('A recording did not cover its source: ' + result['id'])
        if row['ambientFile']:
            speech = [window for window in cue['localMixWindows'] if window['sourceRms'] > .015]
            if not speech or any(window['resampledCorrelation'] < .98 or not .95 <= window['resampledGainRatio'] <= 1.05 for window in speech):
                raise ValueError('Modular speech mismatch: ' + result['id'] + ':' + cue['phase'])
        elif cue['correlation'] < .99 or cue['weakWindows']:
            raise ValueError('Finished-mix mismatch: ' + result['id'])
    native = [player for player in players if player['run'] == result['id']]
    if not native or any(player['errors'] for player in native):
        raise ValueError('Missing native status or a playback error: ' + result['id'])
    caption = captions.get(result['id'])
    if row['mode'] == 'visualize':
        if not caption or caption['missing'] or caption['timingIssues'] or caption['observedPhrases'] != len(row['phrases']):
            raise ValueError('Caption verification failed: ' + result['id'])
        if row['duration'] == 600 and not any('_V5.mp3' in str(player['uri']) for player in native):
            raise ValueError('The native player did not load the repaired source')
    recording = Path(args.recordings) / Path(result['recording']).name
    if not recording.is_file() or recording.stat().st_size != result['recordingBytes']:
        raise ValueError('A durable recording is missing or changed: ' + result['id'])
    digest = hashlib.sha256()
    with recording.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    evidence.append({'id': row['id'], 'runId': result['id'], 'mode': row['mode'], 'nominalSeconds': row['duration'],
        'sourceRuntimeSeconds': row.get('playbackDuration', row['duration']), 'voice': row['voice'], 'passed': True,
        'mountToCompletionSeconds': result['events'][-1]['elapsedMs'] / 1000,
        'minimumCueCorrelation': min(cue['correlation'] for cue in comparison['cues']),
        'minimumResamplingAdjustedSpeechCorrelation': min((window['resampledCorrelation'] for cue in comparison['cues'] for window in cue.get('localMixWindows', []) if window['sourceRms'] > .015), default=None),
        'captionCount': caption['matchedCaptions'] if caption else None, 'captionMaximumPublishDelayMs': caption['maximumPublishDelayMs'] if caption else None,
        'recording': str(recording), 'recordingSha256': digest.hexdigest()})
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
summary = {'passed': len(evidence), 'expected': 30, 'activeAssets': len(inventory['assets']),
           'visualizePhrases': sum(row['expectedPhrases'] for row in captions.values()),
           'renderedCaptions': sum(row['matchedCaptions'] for row in captions.values()),
           'maximumCaptionPublishDelayMs': max(row['maximumPublishDelayMs'] for row in captions.values()), 'controlChecks': len(controls), 'sessions': evidence}
(output / 'acceptance.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
names = {'focus': 'Focus', 'deep_prime': 'Deep Focus', 'visualize': 'Visualize'}
voices = {'male': 'Grounded', 'female': 'Serene', 'warm': 'Warm', 'soothing': 'Soothing'}
lines = ['# Completed Moto acceptance matrix', '', '| Mode | Runtime | Voice | Native playback | Captions |', '|---|---:|---|---|---|']
for item in evidence:
    seconds = round(item['sourceRuntimeSeconds'])
    runtime = f'{seconds // 60}:{seconds % 60:02}'
    caption = f"{item['captionCount']} matched; max {item['captionMaximumPublishDelayMs']} ms" if item['captionCount'] is not None else 'Orientation/intention UI'
    lines.append(f"| {names[item['mode']]} | {runtime} | {voices[item['voice']]} | Passed | {caption} |")
(output / 'matrix.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(json.dumps({key: value for key, value in summary.items() if key != 'sessions'}))
